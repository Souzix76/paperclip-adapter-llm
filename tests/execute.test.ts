/**
 * Integration test for the LLM adapter execute() function.
 *
 * Goals:
 *   1. Prompt build succeeds when config.skillsDir is omitted (regression
 *      guard for the "Cannot read properties of undefined (reading 'skillsDir')"
 *      crash from <0.2.0).
 *   2. Issue lifecycle calls go through PaperclipApi.updateIssue and
 *      PaperclipApi.addIssueComment — the methods that exist on
 *      adapter-utils 2026.428.0 — and not the legacy
 *      updateIssueState / addComment names that triggered runtime TypeErrors.
 *   3. The returned AdapterExecutionResult conforms to the current schema
 *      (exitCode / signal / timedOut required; no `status` or `totalTokens`).
 *
 * Strategy:
 *   - PAPERCLIP_LLM_CLI_PATH is pointed at a per-test stub script written
 *     to /tmp. The stub emits whichever stream-json lines we want and exits
 *     with the requested code.
 *   - global fetch is replaced with an in-memory recorder so we can assert
 *     PaperclipApi calls without a live server. Non-/api requests get a
 *     404 to exercise the OpenRouter /generation 404 fallback.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { execute } from "../src/server/execute.js";

// --- Stub CLI scripts ------------------------------------------------------

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "llm-adapter-test-"));

function writeStubCli(name: string, opts: { stdoutLines?: string[]; exitCode?: number }): string {
  const filePath = path.join(tmpDir, `${name}.mjs`);
  const lines = JSON.stringify(opts.stdoutLines ?? []);
  const exitCode = opts.exitCode ?? 0;
  const source = `#!/usr/bin/env node
const lines = ${lines};
for (const line of lines) {
  process.stdout.write(line + "\\n");
}
process.exit(${exitCode});
`;
  fs.writeFileSync(filePath, source, { mode: 0o755 });
  return filePath;
}

// --- Fetch recorder --------------------------------------------------------

interface CallLog {
  method: string;
  path: string;
  body?: unknown;
}

function setupFetchMock(): { calls: CallLog[]; restore: () => void } {
  const calls: CallLog[] = [];
  const original = globalThis.fetch;

  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input.url;
    const method = (init?.method || "GET").toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const parsed = new URL(url);
    const reqPath = parsed.pathname;

    calls.push({ method, path: reqPath, body });

    if (reqPath.startsWith("/api/")) {
      return new Response(JSON.stringify({ ok: true, id: "issue-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

// --- Context factory -------------------------------------------------------

function makeContext(overrides: Partial<Parameters<typeof execute>[0]> = {}): Parameters<typeof execute>[0] {
  const onLog = vi.fn(async () => {});
  return {
    runId: "run-1",
    agent: {
      id: "agent-1",
      companyId: "company-1",
      name: "Test Agent",
      adapterType: "llm",
      adapterConfig: {},
    },
    runtime: {
      sessionId: null,
      sessionParams: null,
      sessionDisplayId: null,
      taskKey: null,
    },
    config: { model: "moonshotai/kimi-k2.6", apiKey: "test-key" },
    context: {
      wake: {
        reason: "issue_assigned",
        issue: {
          id: "issue-1",
          identifier: "PAP-1",
          title: "Test issue",
          status: "todo",
          priority: "normal",
        },
      },
    },
    onLog,
    authToken: "test-paperclip-jwt",
    ...overrides,
  } as Parameters<typeof execute>[0];
}

// --- Tests -----------------------------------------------------------------

describe("execute()", () => {
  let fetchMock: ReturnType<typeof setupFetchMock>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    fetchMock = setupFetchMock();
    originalEnv = { ...process.env };
    process.env.PAPERCLIP_API_URL = "http://localhost:9999";
  });

  afterEach(() => {
    fetchMock.restore();
    process.env = originalEnv;
  });

  it("builds the prompt when config.skillsDir is omitted", async () => {
    process.env.PAPERCLIP_LLM_CLI_PATH = writeStubCli("done", {
      stdoutLines: ['{"type":"done"}'],
      exitCode: 0,
    });

    const ctx = makeContext();
    expect((ctx.config as Record<string, unknown>).skillsDir).toBeUndefined();

    const result = await execute(ctx);
    expect(result.exitCode).toBe(0);
  });

  it("calls api.updateIssue and api.addIssueComment via the current adapter-utils API", async () => {
    process.env.PAPERCLIP_LLM_CLI_PATH = writeStubCli("hello", {
      stdoutLines: ['{"type":"assistant","content":"hello"}', '{"type":"done"}'],
      exitCode: 0,
    });

    await execute(makeContext());

    const issuePatchCalls = fetchMock.calls.filter(
      (c) => c.method === "PATCH" && c.path === "/api/issues/issue-1",
    );
    expect(issuePatchCalls.length).toBeGreaterThanOrEqual(1);
    expect(issuePatchCalls[0]!.body).toMatchObject({ status: "in_progress" });
    expect(issuePatchCalls.at(-1)!.body).toMatchObject({ status: "done" });

    const commentCalls = fetchMock.calls.filter(
      (c) => c.method === "POST" && c.path === "/api/issues/issue-1/comments",
    );
    expect(commentCalls.length).toBeGreaterThanOrEqual(1);
    expect(commentCalls[0]!.body).toMatchObject({ body: expect.stringContaining("hello") });
  });

  it("returns an AdapterExecutionResult with the current schema (no removed fields)", async () => {
    process.env.PAPERCLIP_LLM_CLI_PATH = writeStubCli("done", {
      stdoutLines: ['{"type":"done"}'],
      exitCode: 0,
    });

    const result = await execute(makeContext());

    expect(result).toMatchObject({
      exitCode: 0,
      signal: null,
      timedOut: false,
    });
    // Removed legacy fields must not be set.
    expect((result as Record<string, unknown>).status).toBeUndefined();
    expect((result.usage as Record<string, unknown> | undefined)?.totalTokens).toBeUndefined();
    // costUsd lives on the result, not on usage.
    expect((result.usage as Record<string, unknown> | undefined)?.costUsd).toBeUndefined();
  });

  it("reports exitCode and marks the issue blocked when the CLI fails", async () => {
    process.env.PAPERCLIP_LLM_CLI_PATH = writeStubCli("fail", {
      stdoutLines: [],
      exitCode: 1,
    });

    const result = await execute(makeContext());

    expect(result.exitCode).toBe(1);
    const blocked = fetchMock.calls.find(
      (c) =>
        c.method === "PATCH" &&
        c.path === "/api/issues/issue-1" &&
        (c.body as any)?.status === "blocked",
    );
    expect(blocked).toBeDefined();
  });

  it("does not throw when LLM_BASE_URL points at a non-OpenRouter endpoint and /generation 404s", async () => {
    process.env.PAPERCLIP_LLM_CLI_PATH = writeStubCli("done", {
      stdoutLines: ['{"type":"done"}'],
      exitCode: 0,
    });

    const result = await execute(
      makeContext({
        config: {
          model: "moonshotai/kimi-k2.6",
          baseUrl: "https://integrate.api.nvidia.com/v1",
          apiKey: "nvapi-test",
        } as any,
      }),
    );

    expect(result.exitCode).toBe(0);
    expect(result.provider).toBe("llm");
  });
});
