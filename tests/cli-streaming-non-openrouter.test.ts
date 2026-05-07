/**
 * Regression test for issue #3.
 *
 * Pre-0.2.3, every continuation streaming chunk emitted by NIM/vLLM/Ollama/
 * DeepSeek-direct carried `delta.role: null`. @openrouter/ai-sdk-provider's
 * Zod schema requires the literal `'assistant'` for that field, so each
 * chunk became an `AI_TypeValidationError` that streamResponse swallowed
 * silently — the agent loop saw zero `text-delta` events and exited with an
 * empty transcript.
 *
 * The fix has two parts:
 *   1. Use @ai-sdk/openai-compatible (which does not enforce OpenRouter's
 *      framing) for any non-openrouter.ai baseUrl.
 *   2. Re-throw on `part.type === 'error'` instead of dropping silently, so
 *      future schema-mismatch surprises never disappear into a zero-event
 *      run again.
 *
 * Strategy:
 *   - Spin a local HTTP server that speaks OpenAI's SSE chat-completions
 *     dialect with `delta.role: null` on continuations (the exact NIM shape
 *     reported in the issue).
 *   - Point streamResponse at it via `baseUrl: http://127.0.0.1:PORT/v1`.
 *   - Assert at least one text chunk was yielded with non-empty content
 *     and that a final `response` chunk arrived.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { streamResponse } from "../cli/src/openrouter.js";

const FIRST_DELTA = {
  id: "chatcmpl-1",
  object: "chat.completion.chunk",
  model: "moonshotai/kimi-k2.6",
  choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }],
};

function continuationDelta(content: string) {
  return {
    id: "chatcmpl-1",
    object: "chat.completion.chunk",
    model: "moonshotai/kimi-k2.6",
    // role: null on continuations — the exact wire shape that broke 0.2.2.
    choices: [{ index: 0, delta: { role: null, content }, finish_reason: null }],
  };
}

const FINAL_DELTA = {
  id: "chatcmpl-1",
  object: "chat.completion.chunk",
  model: "moonshotai/kimi-k2.6",
  choices: [{ index: 0, delta: { role: null, content: "" }, finish_reason: "stop" }],
  usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
};

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.method !== "POST" || !req.url?.endsWith("/chat/completions")) {
      res.statusCode = 404;
      res.end();
      return;
    }
    // Drain the request body — we don't need to read it for this stub.
    req.on("data", () => {});
    req.on("end", () => {
      res.statusCode = 200;
      res.setHeader("content-type", "text/event-stream");
      res.setHeader("cache-control", "no-cache");
      res.write(`data: ${JSON.stringify(FIRST_DELTA)}\n\n`);
      res.write(`data: ${JSON.stringify(continuationDelta("Olá"))}\n\n`);
      res.write(`data: ${JSON.stringify(continuationDelta(" mundo"))}\n\n`);
      res.write(`data: ${JSON.stringify(continuationDelta("!"))}\n\n`);
      res.write(`data: ${JSON.stringify(FINAL_DELTA)}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}/v1`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("streamResponse against a non-OpenRouter endpoint", () => {
  it("yields text deltas when continuation chunks carry delta.role: null", async () => {
    const chunks: any[] = [];
    for await (const c of streamResponse(
      { apiKey: "fake", model: "moonshotai/kimi-k2.6", maxTokens: 50, baseUrl },
      [{ role: "user", content: "diz olá" }],
      {},
    )) {
      chunks.push(c);
    }

    const textChunks = chunks.filter((c) => c.type === "text");
    expect(textChunks.length).toBeGreaterThan(0);

    const text = textChunks.map((c) => c.content).join("");
    expect(text).toContain("Olá");
    expect(text).toContain("mundo");

    // A final response chunk should still arrive (it's how the agent loop
    // knows the stream ended cleanly).
    expect(chunks.find((c) => c.type === "response")).toBeDefined();
  });

  it("propagates streaming errors instead of dropping them silently", async () => {
    // Spin a one-off server that emits an SSE error frame to confirm the
    // re-throw path works.
    const errServer = http.createServer((req, res) => {
      req.on("data", () => {});
      req.on("end", () => {
        res.statusCode = 200;
        res.setHeader("content-type", "text/event-stream");
        res.write(`data: ${JSON.stringify({
          error: { message: "simulated upstream error", type: "invalid_request_error" },
        })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      });
    });

    await new Promise<void>((resolve) => errServer.listen(0, "127.0.0.1", resolve));
    const addr = errServer.address() as AddressInfo;
    const errBaseUrl = `http://127.0.0.1:${addr.port}/v1`;

    let threw = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of streamResponse(
        { apiKey: "fake", model: "test", maxTokens: 10, baseUrl: errBaseUrl },
        [{ role: "user", content: "x" }],
        {},
      )) {
        // consume
      }
    } catch {
      threw = true;
    } finally {
      await new Promise<void>((resolve) => errServer.close(() => resolve()));
    }

    expect(threw).toBe(true);
  });
});
