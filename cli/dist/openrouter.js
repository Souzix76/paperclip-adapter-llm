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
    // Use fullStream so we receive tool-call parts as they arrive — relying on
    // result.response.messages does not work for providers that don't speak the
    // OpenRouter framing convention.
    for await (const part of result.fullStream) {
        if (part.type === 'text-delta' && part.textDelta) {
            yield { type: 'text', content: part.textDelta };
        }
        else if (part.type === 'tool-call') {
            yield {
                type: 'tool-call',
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                args: part.args,
            };
        }
        // text-delta / tool-call cover everything the agent loop needs. Other
        // event types (step-start, step-finish, finish, error, reasoning) are
        // ignored on purpose — the agent loop will surface streamText errors
        // by throwing from `await result.response` below if needed.
    }
    const response = await result.response;
    yield { type: 'response', response };
}
