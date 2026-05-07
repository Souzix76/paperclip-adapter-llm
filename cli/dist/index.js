#!/usr/bin/env node
import { runAgent } from './agent.js';
import { parseArgs } from 'node:util';
const { values, positionals } = parseArgs({
    options: {
        model: { type: 'string', default: 'anthropic/claude-3.5-sonnet' },
        'max-tokens': { type: 'string', default: '4096' },
        'output-format': { type: 'string', default: 'stream-json' },
        print: { type: 'boolean', default: false },
        'api-key': { type: 'string' },
        'base-url': { type: 'string' },
    },
    allowPositionals: true,
});
async function readStdin() {
    return new Promise((resolve) => {
        let data = '';
        process.stdin.on('data', chunk => data += chunk);
        process.stdin.on('end', () => resolve(data.trim()));
    });
}
const prompt = values.print ? await readStdin() : positionals.join(' ');
if (!prompt) {
    console.error('Error: No prompt provided');
    process.exit(1);
}
const baseUrl = values['base-url'] || process.env.LLM_BASE_URL || undefined;
function isLocalhostUrl(url) {
    if (!url)
        return false;
    try {
        const u = new URL(url);
        return ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(u.hostname);
    }
    catch {
        return false;
    }
}
const apiKey = values['api-key'] ||
    process.env.LLM_API_KEY ||
    process.env.OPENROUTER_API_KEY;
if (!apiKey && !isLocalhostUrl(baseUrl)) {
    console.error('Error: LLM_API_KEY (or OPENROUTER_API_KEY) is required for non-localhost endpoints');
    process.exit(1);
}
await runAgent({
    prompt,
    model: values.model,
    maxTokens: parseInt(values['max-tokens'], 10),
    apiKey: apiKey || '',
    outputFormat: values['output-format'],
    baseUrl,
});
