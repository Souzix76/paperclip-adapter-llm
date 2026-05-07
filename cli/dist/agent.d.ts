export interface AgentOptions {
    prompt: string;
    model: string;
    maxTokens: number;
    apiKey: string;
    outputFormat: 'stream-json' | 'text';
    /** OpenAI-compatible base URL. Defaults to OpenRouter when omitted. */
    baseUrl?: string;
}
export declare function runAgent(options: AgentOptions): Promise<void>;
//# sourceMappingURL=agent.d.ts.map