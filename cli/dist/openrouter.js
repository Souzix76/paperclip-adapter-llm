import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText } from 'ai';
export async function* streamResponse(config, messages, tools) {
    const openrouter = createOpenRouter({
        apiKey: config.apiKey,
        ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
    });
    const result = await streamText({
        model: openrouter(config.model),
        messages,
        maxTokens: config.maxTokens || 4096,
        tools,
        toolChoice: 'auto',
    });
    for await (const chunk of result.textStream) {
        yield { type: 'text', content: chunk };
    }
    const response = await result.response;
    yield { type: 'response', response };
}
