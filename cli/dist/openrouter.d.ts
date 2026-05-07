import { type CoreMessage } from 'ai';
export interface OpenRouterConfig {
    apiKey: string;
    model: string;
    maxTokens?: number;
    /** OpenAI-compatible base URL. Defaults to OpenRouter when omitted. */
    baseUrl?: string;
}
export declare function streamResponse(config: OpenRouterConfig, messages: CoreMessage[], tools: Record<string, any>): AsyncGenerator<{
    type: string;
    content: string;
    response?: undefined;
} | {
    type: string;
    response: import("ai").LanguageModelResponseMetadata & {
        messages: Array<(import("ai").CoreAssistantMessage | import("ai").CoreToolMessage) & {
            id: string;
        }>;
    };
    content?: undefined;
}, void, unknown>;
//# sourceMappingURL=openrouter.d.ts.map