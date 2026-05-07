import { streamResponse } from './openrouter.js';
import { tools, executeTool } from './tools/index.js';
import { emitEvent } from './stream.js';
export async function runAgent(options) {
    const messages = [
        { role: 'user', content: options.prompt }
    ];
    const toolDefinitions = Object.fromEntries(Object.entries(tools).map(([name, tool]) => [name, {
            description: tool.description,
            parameters: tool.parameters,
        }]));
    let iteration = 0;
    const MAX_ITERATIONS = 25;
    while (iteration < MAX_ITERATIONS) {
        iteration++;
        let fullText = '';
        const collectedToolCalls = [];
        for await (const chunk of streamResponse({ apiKey: options.apiKey, model: options.model, maxTokens: options.maxTokens, baseUrl: options.baseUrl }, messages, toolDefinitions)) {
            if (chunk.type === 'text' && chunk.content) {
                fullText += chunk.content;
                if (options.outputFormat === 'stream-json') {
                    emitEvent({ type: 'assistant', content: chunk.content });
                }
                else {
                    process.stdout.write(chunk.content);
                }
            }
            else if (chunk.type === 'tool-call') {
                collectedToolCalls.push({
                    toolCallId: chunk.toolCallId,
                    toolName: chunk.toolName,
                    args: chunk.args,
                });
            }
            // chunk.type === 'response' is intentionally ignored for assistant message
            // reconstruction — many OpenAI-compatible providers (NIM, vLLM, Ollama,
            // DeepSeek direct) do not populate response.messages, which crashed the
            // CLI in <0.2.2.
        }
        // Reconstruct the assistant message from the data we observed in-stream.
        // This is the canonical shape the ai SDK expects in subsequent turns.
        const content = [];
        if (fullText.length > 0) {
            content.push({ type: 'text', text: fullText });
        }
        for (const tc of collectedToolCalls) {
            content.push({
                type: 'tool-call',
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                args: tc.args,
            });
        }
        const assistantMessage = content.length === 1 && content[0].type === 'text'
            ? { role: 'assistant', content: fullText }
            : { role: 'assistant', content: content };
        messages.push(assistantMessage);
        if (collectedToolCalls.length === 0) {
            if (options.outputFormat === 'stream-json') {
                emitEvent({ type: 'done' });
            }
            break;
        }
        const toolResults = await Promise.all(collectedToolCalls.map(async (toolCall) => {
            const start = Date.now();
            try {
                if (options.outputFormat === 'stream-json') {
                    emitEvent({
                        type: 'tool_use',
                        id: toolCall.toolCallId,
                        name: toolCall.toolName,
                        input: toolCall.args,
                    });
                }
                const result = await executeTool(toolCall.toolName, toolCall.args);
                if (options.outputFormat === 'stream-json') {
                    emitEvent({
                        type: 'tool_result',
                        id: toolCall.toolCallId,
                        content: result.content,
                        is_error: result.isError,
                        duration_ms: Date.now() - start,
                    });
                }
                return {
                    type: 'tool-result',
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    result: result.content,
                    isError: result.isError,
                };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (options.outputFormat === 'stream-json') {
                    emitEvent({
                        type: 'tool_result',
                        id: toolCall.toolCallId,
                        content: errorMessage,
                        is_error: true,
                        duration_ms: Date.now() - start,
                    });
                }
                return {
                    type: 'tool-result',
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    result: errorMessage,
                    isError: true,
                };
            }
        }));
        messages.push({
            role: 'tool',
            content: toolResults,
        });
    }
    if (iteration >= MAX_ITERATIONS) {
        if (options.outputFormat === 'stream-json') {
            emitEvent({ type: 'error', message: 'Max iterations reached' });
        }
    }
}
