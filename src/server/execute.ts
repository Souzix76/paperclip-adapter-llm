/**
 * LLM adapter execute() — thin proxy to the bundled openrouter/llm CLI.
 *
 * Responsibilities:
 *   - Build prompt from Paperclip wake context (extracted from ctx.context) + skills
 *   - Spawn the CLI subprocess with --model / --base-url / --max-tokens
 *   - Map CLI's stream-json events to Paperclip TranscriptEntry
 *   - Manage issue state (in_progress at start, done/blocked at end)
 *   - Post the final assistant output as an issue comment
 *
 * Aligned with @paperclipai/adapter-utils 2026.428.0 API surface:
 *   - PaperclipApi exposes updateIssue / addIssueComment (not updateIssueState / addComment)
 *   - UsageSummary has only inputTokens / outputTokens / cachedInputTokens
 *   - AdapterExecutionResult requires exitCode / signal / timedOut; costUsd is top-level
 *   - renderPaperclipWakePrompt takes { resumedSession? } only
 *   - emitInit requires sessionId; emitToolCall uses { name, input, toolUseId }
 */

import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
  UsageSummary,
} from "@paperclipai/adapter-utils";
import { renderPaperclipWakePrompt } from "@paperclipai/adapter-utils/server-utils";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_BASE_URL,
  resolveEndpoints,
  type LlmConfig,
} from "../index.js";
import { PaperclipApi } from "./paperclip-api.js";
import { loadSkills, renderSkillsForPrompt } from "./skills.js";
import {
  emitInit,
  emitAssistant,
  emitToolCall,
  emitToolResult,
  emitResult,
  emitSystem,
  writeRawStderr,
} from "./transcript.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CLI_PATH = path.resolve(__dirname, "../../cli/dist/index.js");

/**
 * Path to the LLM CLI subprocess. Override with PAPERCLIP_LLM_CLI_PATH for
 * integration tests so they can supply a deterministic stand-in.
 */
function resolveCliPath(): string {
  const override = process.env.PAPERCLIP_LLM_CLI_PATH;
  if (override && override.trim().length > 0) return override.trim();
  return DEFAULT_CLI_PATH;
}

const DEFAULT_RESULT: AdapterExecutionResult = {
  exitCode: null,
  signal: null,
  timedOut: false,
};

/**
 * Best-effort extraction of the wake payload from ctx.context. Different
 * Paperclip server versions have placed it under different keys; we try the
 * most-specific first and fall back to the whole context object so the
 * adapter is resilient to schema drift.
 */
function extractWakePayload(context: Record<string, unknown> | undefined): unknown {
  if (!context || typeof context !== "object") return null;
  const candidates = ["wake", "wakePayload", "paperclipWake"];
  for (const key of candidates) {
    const value = (context as Record<string, unknown>)[key];
    if (value && typeof value === "object") return value;
  }
  return context;
}

function extractIssueId(wake: unknown, context: Record<string, unknown> | undefined): string | null {
  if (wake && typeof wake === "object") {
    const issue = (wake as Record<string, unknown>).issue;
    if (issue && typeof issue === "object") {
      const id = (issue as Record<string, unknown>).id;
      if (typeof id === "string" && id.length > 0) return id;
    }
  }
  if (context && typeof context === "object") {
    const direct = (context as Record<string, unknown>).issueId;
    if (typeof direct === "string" && direct.length > 0) return direct;
  }
  return null;
}

export async function execute(
  ctx: AdapterExecutionContext
): Promise<AdapterExecutionResult> {
  const { config: rawConfig, context, onLog, authToken, runId } = ctx;
  const config = (rawConfig ?? {}) as LlmConfig & Record<string, unknown>;

  const endpoints = resolveEndpoints(config.baseUrl);
  if (config.baseUrl && endpoints.base !== DEFAULT_BASE_URL) {
    await emitSystem(onLog, `Using LLM endpoint: ${endpoints.base}`);
  }

  const wake = extractWakePayload(context);
  const issueId = extractIssueId(wake, context);

  const api = new PaperclipApi({
    authToken: authToken ?? "",
  });

  // ----------------------------------------------------------------------
  // 1. Set issue to in_progress (best-effort)
  // ----------------------------------------------------------------------
  if (issueId) {
    try {
      await api.updateIssue(issueId, { status: "in_progress" });
    } catch (err) {
      await emitSystem(onLog, `Failed to set issue to in_progress: ${err instanceof Error ? err.message : String(err)}`);
      // Continue anyway — the run can still produce useful output.
    }
  }

  // ----------------------------------------------------------------------
  // 2. Build the prompt (skills + wake)
  // ----------------------------------------------------------------------
  let prompt = "";
  try {
    const skills = await loadSkills({ agentConfig: config, onLog });
    const renderedSkills = renderSkillsForPrompt(skills);
    const wakePrompt = renderPaperclipWakePrompt(wake);
    prompt = renderedSkills ? `${renderedSkills}\n\n---\n\n${wakePrompt}` : wakePrompt;

    // Some heartbeats arrive without a structured wake payload (manual
    // "Run Heartbeat" with no scoped issue, or a wake context the current
    // server schema doesn't fill in). renderPaperclipWakePrompt returns
    // an empty string in those cases, which the CLI rejects with
    // "No prompt provided" → exit 1 → empty transcript. Fall back to a
    // concise three-line instruction so the model has something to work
    // with. Tools/skills are added separately above when present.
    if (prompt.trim().length === 0) {
      const issueLine = issueId ? ` (issue ${issueId})` : "";
      prompt = [
        `You have just received a heartbeat from Paperclip${issueLine}.`,
        "No structured wake context was provided — proceed using the tools available to you.",
        "Take the next useful action toward your current responsibilities, then end the run.",
      ].join("\n");
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await emitSystem(onLog, `Error building prompt: ${reason}`);
    if (issueId) {
      try {
        await api.addIssueComment(issueId, { body: `Failed to build prompt: ${reason}` });
        await api.updateIssue(issueId, { status: "blocked" });
      } catch {
        // Network/auth errors during error handling are non-fatal.
      }
    }
    return {
      ...DEFAULT_RESULT,
      exitCode: 1,
      errorMessage: reason,
    };
  }

  await emitInit(onLog, {
    model: typeof config.model === "string" ? config.model : "anthropic/claude-3.5-sonnet",
    sessionId: runId,
  });

  // ----------------------------------------------------------------------
  // 3. Spawn the CLI subprocess
  // ----------------------------------------------------------------------
  const cliArgs = [
    resolveCliPath(),
    "--print",
    "--output-format", "stream-json",
    "--model", typeof config.model === "string" ? config.model : "anthropic/claude-3.5-sonnet",
    "--max-tokens", String(typeof config.maxTokens === "number" ? config.maxTokens : 4096),
    "--base-url", endpoints.base,
  ];

  // Prefer `adapterConfig.apiKey` (persisted via the form / API), then fall
  // back to `authToken` (legacy path: Paperclip core injects an OpenRouter
  // token here for adapters that share the platform-wide key).
  const llmApiKey = (typeof config.apiKey === "string" && config.apiKey.length > 0)
    ? config.apiKey
    : (authToken ?? "");

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    LLM_API_KEY: llmApiKey,
    LLM_BASE_URL: endpoints.base,
    // Backwards-compat alias for existing OpenRouter installs.
    OPENROUTER_API_KEY: llmApiKey,
  };

  const cwd = typeof config.cwd === "string" && config.cwd.length > 0 ? config.cwd : process.cwd();

  const child = spawn("node", cliArgs, {
    cwd,
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
  };
  let costUsd = 0;

  // ----------------------------------------------------------------------
  // 4. Process stream-json events from the CLI
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
              if (typeof event.content === "string") {
                finalAssistantContent += event.content;
                void emitAssistant(onLog, event.content, { delta: true });
              }
              break;
            case "tool_use":
              void emitToolCall(onLog, {
                name: String(event.name ?? ""),
                input: event.input,
                toolUseId: typeof event.id === "string" ? event.id : undefined,
              });
              break;
            case "tool_result":
              void emitToolResult(onLog, {
                toolUseId: String(event.id ?? ""),
                content: typeof event.content === "string" ? event.content : JSON.stringify(event.content ?? ""),
                isError: Boolean(event.is_error),
              });
              break;
            case "error":
              void emitSystem(onLog, `CLI error: ${event.message}`);
              break;
            case "done":
              break;
            case "usage":
              if (typeof event.input_tokens === "number") usage.inputTokens = event.input_tokens;
              if (typeof event.output_tokens === "number") usage.outputTokens = event.output_tokens;
              if (typeof event.cached_tokens === "number") usage.cachedInputTokens = event.cached_tokens;
              if (typeof event.cost_usd === "number") costUsd = event.cost_usd;
              break;
            default:
              break;
          }
        } catch {
          // Not JSON — surface as a system entry rather than crashing.
          void emitSystem(onLog, `CLI stdout: ${line}`);
        }
      }
    });

    child.stdout.on("end", resolve);
    child.stdout.on("error", reject);
  });

  const stderrPromise = new Promise<void>((resolve, reject) => {
    child.stderr.on("data", (chunk: Buffer) => {
      void writeRawStderr(onLog, chunk.toString());
    });
    child.stderr.on("end", resolve);
    child.stderr.on("error", reject);
  });

  const exitCode = await new Promise<number | null>((resolve) => {
    child.on("close", (code) => resolve(code));
  });

  await Promise.all([stdoutPromise, stderrPromise]);

  // ----------------------------------------------------------------------
  // 5. OpenRouter cost reporting (silently 404s on other providers)
  // ----------------------------------------------------------------------
  if (endpoints.base === DEFAULT_BASE_URL) {
    try {
      const genRes = await fetch(endpoints.generation, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (genRes.ok) {
        const genData = await genRes.json() as any;
        const latest = genData?.data?.[0];
        if (latest) {
          if (typeof latest.usage?.prompt_tokens === "number") usage.inputTokens = latest.usage.prompt_tokens;
          if (typeof latest.usage?.completion_tokens === "number") usage.outputTokens = latest.usage.completion_tokens;
          if (typeof latest.total_cost === "number") costUsd = latest.total_cost;
        }
      }
    } catch {
      // /generation isn't part of the OpenAI-compatible standard.
    }
  }

  // ----------------------------------------------------------------------
  // 6. Add final comment and update issue state (best-effort)
  // ----------------------------------------------------------------------
  if (issueId) {
    try {
      await api.addIssueComment(issueId, {
        body: finalAssistantContent || "_(No output from agent)_",
      });
    } catch (err) {
      await emitSystem(onLog, `Failed to post final comment: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      if (exitCode === 0) {
        await api.updateIssue(issueId, { status: "done" });
      } else {
        await api.updateIssue(issueId, { status: "blocked" });
        await api.addIssueComment(issueId, { body: `CLI exited with code ${exitCode ?? "(unknown)"}` });
      }
    } catch (err) {
      await emitSystem(onLog, `Failed to update issue status: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await emitResult(onLog, {
    text: finalAssistantContent.slice(0, 500),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cachedTokens: usage.cachedInputTokens ?? 0,
    costUsd,
    subtype: exitCode === 0 ? "success" : "error",
    isError: exitCode !== 0,
    errors: exitCode === 0 ? [] : [`CLI exited with code ${exitCode ?? "(unknown)"}`],
  });

  return {
    exitCode: exitCode ?? null,
    signal: null,
    timedOut: false,
    usage,
    costUsd,
    model: typeof config.model === "string" ? config.model : null,
    provider: endpoints.base === DEFAULT_BASE_URL ? "openrouter" : "llm",
  };
}
