import { z } from 'zod';
import type { ToolResult } from './index.js';
export declare const runCommandSchema: z.ZodObject<{
    command: z.ZodString;
    timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    command: string;
    timeout: number;
}, {
    command: string;
    timeout?: number | undefined;
}>;
export declare function runCommand(args: z.infer<typeof runCommandSchema>): Promise<ToolResult>;
//# sourceMappingURL=command.d.ts.map