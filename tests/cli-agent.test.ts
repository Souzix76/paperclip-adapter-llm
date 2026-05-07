/**
 * Regression test for the CLI agent loop.
 *
 * Issue #2: when LLM_BASE_URL points at a non-OpenRouter provider (NIM,
 * vLLM, Ollama), the underlying ai-sdk `streamText` response object does
 * not populate `response.messages[0]`, so the previous implementation
 * crashed at agent.ts:32 with `Cannot read properties of undefined
 * (reading 'content')`.
 *
 * After the fix, runAgent reconstructs the assistant message from the
 * stream chunks it has already observed and never reads
 * `chunk.response.messages[0]`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Replace streamResponse with a controllable async generator before agent.ts loads.
const { streamResponseMock } = vi.hoisted(() => ({ streamResponseMock: vi.fn() }));

vi.mock("../cli/src/openrouter.js", () => ({
  streamResponse: (...args: unknown[]) => streamResponseMock(...args),
}));

import { runAgent } from "../cli/src/agent.js";

async function* yieldChunks(chunks: any[]) {
  for (const c of chunks) yield c;
}

describe("runAgent (CLI agent loop)", () => {
  let stdoutWrite: ReturnType<typeof vi.spyOn>;
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation((chunk: any) => {
      stdout.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    });
    streamResponseMock.mockReset();
  });

  afterEach(() => {
    stdoutWrite.mockRestore();
  });

  it("does not throw when the provider response has no messages[0] (NIM/vLLM/Ollama)", async () => {
    // Mimic a NIM response: text deltas only, then a `response` chunk whose
    // `messages` array is empty. The pre-0.2.2 code crashed on
    // chunk.response.messages[0].content.
    streamResponseMock.mockReturnValueOnce(
      yieldChunks([
        { type: "text", content: "olá " },
        { type: "text", content: "mundo" },
        { type: "response", response: { messages: [] } },
      ]),
    );

    await expect(
      runAgent({
        prompt: "say hello",
        model: "moonshotai/kimi-k2.6",
        maxTokens: 64,
        apiKey: "fake",
        outputFormat: "stream-json",
        baseUrl: "https://integrate.api.nvidia.com/v1",
      }),
    ).resolves.toBeUndefined();

    const events = stdout
      .join("")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));

    expect(events.find((e) => e.type === "assistant" && e.content === "olá ")).toBeDefined();
    expect(events.find((e) => e.type === "assistant" && e.content === "mundo")).toBeDefined();
    expect(events.find((e) => e.type === "done")).toBeDefined();
  });

  it("does not throw when the response chunk is missing entirely", async () => {
    // Even more degenerate: provider stream finishes with no `response` chunk.
    streamResponseMock.mockReturnValueOnce(
      yieldChunks([{ type: "text", content: "hi" }]),
    );

    await expect(
      runAgent({
        prompt: "ping",
        model: "deepseek-chat",
        maxTokens: 32,
        apiKey: "fake",
        outputFormat: "stream-json",
        baseUrl: "https://api.deepseek.com/v1",
      }),
    ).resolves.toBeUndefined();
  });

  it("emits a done event when the model returns no tool calls", async () => {
    streamResponseMock.mockReturnValueOnce(
      yieldChunks([
        { type: "text", content: "5 palavras curtas aqui agora" },
        { type: "response", response: { messages: [] } },
      ]),
    );

    await runAgent({
      prompt: "say five words",
      model: "moonshotai/kimi-k2.6",
      maxTokens: 32,
      apiKey: "fake",
      outputFormat: "stream-json",
      baseUrl: "https://integrate.api.nvidia.com/v1",
    });

    const lines = stdout.join("").trim().split("\n");
    const events = lines.map((l) => JSON.parse(l));
    const last = events.at(-1);
    expect(last).toEqual({ type: "done" });
  });
});
