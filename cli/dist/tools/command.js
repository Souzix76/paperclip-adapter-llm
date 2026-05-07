import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
const execAsync = promisify(exec);
export const runCommandSchema = z.object({
    command: z.string().describe('The shell command to execute'),
    timeout: z.number().optional().default(30000).describe('Timeout in milliseconds'),
});
export async function runCommand(args) {
    try {
        const { stdout, stderr } = await execAsync(args.command, {
            timeout: args.timeout || 30000,
            maxBuffer: 10 * 1024 * 1024, // 10MB
        });
        const output = stdout + (stderr ? `\n[stderr]\n${stderr}` : '');
        return { content: output || '(no output)', isError: false };
    }
    catch (error) {
        return {
            content: `Command failed (exit code ${error.code}): ${error.stderr || error.message}`,
            isError: true
        };
    }
}
