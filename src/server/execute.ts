/**
 * OpenRouter adapter execute() — thin proxy to openrouter-cli.
 *
 * Responsibilities:
 *   - Build prompt from Paperclip wake context + skills
 *   - Spawn openrouter-cli with the prompt
 *   - Map CLI's stream-json events to Paperclip TranscriptEntry
 *   - Manage issue state (in_progress at start, done/blocked at end)
 *   - Post the final assistant output as an issue comment
 */

import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
  UsageSummary,
} from "@paperclipai/adapter-utils";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import {
  renderPaperclipWakePrompt,
} from "@paperclipai/adapter-utils/server-utils";

import {
  DEFAULT_BASE_URL,
  resolveEndpoints,
  type LlmConfig,
} from "../index.js";
import { PaperclipApi, PaperclipApiError } from "./paperclip-api.js";
import { loadSkills, renderSkillsForPrompt } from "./skills.js";
import {
  emitInit,
  emitAssistant,
  emitToolCall,
  emitToolResult,
  emitResult,
  emitSystem,
  writeRawStderr,
  type OnLog,
} from "./transcript.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, "../../cli/dist/index.js");

export async function execute(
  ctx: AdapterExecutionContext<LlmConfig>
): Promise<AdapterExecutionResult> {
  const { wake, issueId, config, onLog, authToken } = ctx;

  const endpoints = resolveEndpoints(config.baseUrl);
  if (config.baseUrl && endpoints.base !== DEFAULT_BASE_URL) {
    emitSystem(onLog, `Using LLM endpoint: ${endpoints.base}`);
  }

  const api = new PaperclipApi(ctx);

  // ----------------------------------------------------------------------
  // 1. Set issue to in_progress
  // ----------------------------------------------------------------------
  try {
    await api.updateIssueState(issueId, "in_progress");
  } catch (err) {
    emitSystem(onLog, `Failed to set issue to in_progress: ${err}`);
    // Continue anyway
  }

  // ----------------------------------------------------------------------
  // 2. Build the prompt
  // ----------------------------------------------------------------------
  let prompt = "";
  try {
    const skills = await loadSkills(config);
    const renderedSkills = renderSkillsForPrompt(skills);
    const paperclipWake = renderPaperclipWakePrompt(wake, {
      skillsPrompt: renderedSkills,
      supportsImages: false,
    });
    prompt = paperclipWake;
  } catch (err) {
    emitSystem(onLog, `Error building prompt: ${err}`);
    await api.addComment(issueId, `Failed to build prompt: ${err}`);
    await api.updateIssueState(issueId, "blocked");
    return { status: "error" };
  }

  emitInit(onLog, { model: config.model || "anthropic/claude-3.5-sonnet" });

  // ----------------------------------------------------------------------
  // 3. Spawn openrouter-cli
  // ----------------------------------------------------------------------
  const cliArgs = [
    CLI_PATH,
    "--print",
    "--output-format", "stream-json",
    "--model", config.model || "anthropic/claude-3.5-sonnet",
    "--max-tokens", String(config.maxTokens || 4096),
    "--base-url", endpoints.base,
  ];

  const env = {
    ...process.env,
    LLM_API_KEY: authToken,
    LLM_BASE_URL: endpoints.base,
    // Backwards-compat alias for existing OpenRouter installs.
    OPENROUTER_API_KEY: authToken,
  };

  const child = spawn("node", cliArgs, {
    cwd: config.cwd || process.cwd(),
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Write prompt to stdin
  child.stdin.write(prompt);
  child.stdin.end();

  let finalAssistantContent = "";
  const usage: UsageSummary = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
  };

  // ----------------------------------------------------------------------
  // 4. Process stream-json events from CLI
  // ----------------------------------------------------------------------
  const stdoutPromise = new Promise<void>((resolve, reject) => {
    let buffer = "";
    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          switch (event.type) {
            case "assistant":
              finalAssistantContent += event.content;
              emitAssistant(onLog, event.content);
              break;
            case "tool_use":
              emitToolCall(onLog, {
                id: event.id,
                name: event.name,
                arguments: JSON.stringify(event.input),
              });
              break;
            case "tool_result":
              emitToolResult(onLog, {
                toolUseId: event.id,
                content: event.content,
                isError: event.is_error,
                durationMs: event.duration_ms,
              });
              break;
            case "error":
              emitSystem(onLog, `CLI error: ${event.message}`);
              break;
            case "done":
              // All good
              break;
            default:
              // Unknown event, ignore
              break;
          }
        } catch {
          // Not JSON, treat as raw stdout (shouldn't happen with stream-json)
          emitSystem(onLog, `CLI stdout: ${line}`);
        }
      }
    });

    child.stdout.on("end", resolve);
    child.stdout.on("error", reject);
  });

  const stderrPromise = new Promise<void>((resolve, reject) => {
    child.stderr.on("data", (chunk: Buffer) => {
      writeRawStderr(onLog, chunk.toString());
    });
    child.stderr.on("end", resolve);
    child.stderr.on("error", reject);
  });

  const exitCode = await new Promise<number>((resolve) => {
    child.on("close", resolve);
  });

  await Promise.all([stdoutPromise, stderrPromise]);

  // ----------------------------------------------------------------------
  // 5. Fetch usage from /generation (OpenRouter-specific; silently 404s elsewhere)
  // ----------------------------------------------------------------------
  try {
    const genRes = await fetch(endpoints.generation, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (genRes.ok) {
      const genData = await genRes.json() as any;
      const latest = genData.data?.[0];
      if (latest) {
        usage.inputTokens = latest.usage?.prompt_tokens || 0;
        usage.outputTokens = latest.usage?.completion_tokens || 0;
        usage.totalTokens = latest.usage?.total_tokens || 0;
        usage.costUsd = latest.total_cost || 0;
      }
    }
    // Non-OpenRouter providers will 404 here; usage stays at zero.
    // TODO: parse `usage` field from CLI stream-json events for cross-provider cost.
  } catch {
    // Ignore — non-OpenRouter providers don't expose /generation.
  }

  // ----------------------------------------------------------------------
  // 6. Add final comment and update issue state
  // ----------------------------------------------------------------------
  if (finalAssistantContent) {
    await api.addComment(issueId, finalAssistantContent);
  } else {
    await api.addComment(issueId, "_(No output from agent)_");
  }

  if (exitCode === 0) {
    await api.updateIssueState(issueId, "done");
  } else {
    await api.updateIssueState(issueId, "blocked");
    await api.addComment(issueId, `CLI exited with code ${exitCode}`);
  }

  emitResult(onLog, {
    exitCode,
    finalAnswer: finalAssistantContent.slice(0, 500),
    usage,
  });

  return {
    status: exitCode === 0 ? "success" : "error",
    usage,
  };
}
