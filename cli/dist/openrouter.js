import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';
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
function isOpenRouterUrl(baseUrl) {
    if (!baseUrl)
        return true;
    try {
        return new URL(baseUrl).host.endsWith('openrouter.ai');
    }
    catch {
        return false;
    }
}
function resolveModel(config) {
    if (isOpenRouterUrl(config.baseUrl)) {
        const provider = createOpenRouter({
            apiKey: config.apiKey,
            ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
        });
        return provider(config.model);
    }
    const provider = createOpenAICompatible({
        name: 'openai-compatible',
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
    });
    return provider(config.model);
}
export async function* streamResponse(config, messages, tools) {
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
        else if (part.type === 'error') {
            // Never drop streaming errors silently — pre-0.2.3 these were swallowed,
            // which manifested as exit-0 runs with empty transcripts.
            const err = part.error;
            if (err instanceof Error)
                throw err;
            throw new Error(typeof err === 'string' ? err : JSON.stringify(err));
        }
        // Other event types (step-start, step-finish, finish, reasoning) are
        // ignored on purpose — they don't carry data the agent loop needs.
    }
    const response = await result.response;
    yield { type: 'response', response };
}
