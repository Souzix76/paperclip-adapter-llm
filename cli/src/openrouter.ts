import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText, type CoreMessage, type LanguageModelV1 } from 'ai';

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  /** OpenAI-compatible base URL. Defaults to OpenRouter when omitted. */
  baseUrl?: string;
}

/**
 * Stream chunks emitted by streamResponse. The agent loop reconstructs the
 * assistant message from these chunks rather than relying on `response.messages`,
 * which is populated by OpenRouter but undefined for many other OpenAI-compatible
 * providers (NIM, vLLM, Ollama, DeepSeek direct).
 */
export type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'response'; response: unknown };

/**
 * @openrouter/ai-sdk-provider's Zod schema requires `delta.role === 'assistant'`
 * on every continuation chunk. NIM/vLLM/Ollama/DeepSeek-direct emit
 * `delta.role: null` on continuations (valid per the OpenAI streaming spec —
 * role is only required on the first delta), which trips an
 * AI_TypeValidationError that streamResponse silently swallowed pre-0.2.3.
 *
 * For non-OpenRouter endpoints we therefore use @ai-sdk/openai-compatible,
 * which does not enforce the OpenRouter-specific framing.
 */
function isOpenRouterUrl(baseUrl: string | undefined): boolean {
  if (!baseUrl) return true;
  try {
    return new URL(baseUrl).host.endsWith('openrouter.ai');
  } catch {
    return false;
  }
}

function resolveModel(config: OpenRouterConfig): LanguageModelV1 {
  if (isOpenRouterUrl(config.baseUrl)) {
    const provider = createOpenRouter({
      apiKey: config.apiKey,
      ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
    });
    return provider(config.model) as unknown as LanguageModelV1;
  }
  const provider = createOpenAICompatible({
    name: 'openai-compatible',
    apiKey: config.apiKey,
    baseURL: config.baseUrl!,
  });
  return provider(config.model) as unknown as LanguageModelV1;
}

export async function* streamResponse(
  config: OpenRouterConfig,
  messages: CoreMessage[],
  tools: Record<string, any>,
): AsyncGenerator<StreamChunk> {
  const result = await streamText({
    model: resolveModel(config),
    messages,
    maxTokens: config.maxTokens || 4096,
    tools,
    toolChoice: 'auto',
  });

  // Use fullStream so we receive tool-call parts as they arrive — relying on
  // result.response.messages does not work for providers that don't speak the
  // OpenRouter framing convention.
  for await (const part of result.fullStream as AsyncIterable<any>) {
    if (part.type === 'text-delta' && part.textDelta) {
      yield { type: 'text', content: part.textDelta };
    } else if (part.type === 'tool-call') {
      yield {
        type: 'tool-call',
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        args: part.args,
      };
    } else if (part.type === 'error') {
      // Never drop streaming errors silently — pre-0.2.3 these were swallowed,
      // which manifested as exit-0 runs with empty transcripts.
      const err = (part as { error: unknown }).error;
      if (err instanceof Error) throw err;
      throw new Error(typeof err === 'string' ? err : JSON.stringify(err));
    }
    // Other event types (step-start, step-finish, finish, reasoning) are
    // ignored on purpose — they don't carry data the agent loop needs.
  }

  const response = await result.response;
  yield { type: 'response', response };
}
