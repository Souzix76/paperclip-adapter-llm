import { type CoreMessage } from 'ai';
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
export type StreamChunk = {
    type: 'text';
    content: string;
} | {
    type: 'tool-call';
    toolCallId: string;
    toolName: string;
    args: unknown;
} | {
    type: 'response';
    response: unknown;
};
export declare function streamResponse(config: OpenRouterConfig, messages: CoreMessage[], tools: Record<string, any>): AsyncGenerator<StreamChunk>;
//# sourceMappingURL=openrouter.d.ts.map