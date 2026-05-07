import { z } from 'zod';
export interface Tool {
    description: string;
    parameters: z.ZodSchema;
    execute: (args: any) => Promise<ToolResult>;
}
export interface ToolResult {
    content: string;
    isError: boolean;
}
export declare const tools: Record<string, Tool>;
export declare function executeTool(name: string, args: any): Promise<ToolResult>;
//# sourceMappingURL=index.d.ts.map