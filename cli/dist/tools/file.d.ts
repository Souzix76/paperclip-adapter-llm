import type { ToolResult } from './index.js';
import { z } from 'zod';
export declare const readFileSchema: z.ZodObject<{
    path: z.ZodString;
    offset: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    path: string;
    offset?: number | undefined;
    limit?: number | undefined;
}, {
    path: string;
    offset?: number | undefined;
    limit?: number | undefined;
}>;
export declare function readFile(args: z.infer<typeof readFileSchema>): Promise<ToolResult>;
export declare const writeFileSchema: z.ZodObject<{
    path: z.ZodString;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    path: string;
    content: string;
}, {
    path: string;
    content: string;
}>;
export declare function writeFile(args: z.infer<typeof writeFileSchema>): Promise<ToolResult>;
export declare const editFileSchema: z.ZodObject<{
    path: z.ZodString;
    edits: z.ZodArray<z.ZodObject<{
        old_string: z.ZodString;
        new_string: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        old_string: string;
        new_string: string;
    }, {
        old_string: string;
        new_string: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    path: string;
    edits: {
        old_string: string;
        new_string: string;
    }[];
}, {
    path: string;
    edits: {
        old_string: string;
        new_string: string;
    }[];
}>;
export declare function editFile(args: z.infer<typeof editFileSchema>): Promise<ToolResult>;
export declare const listFilesSchema: z.ZodObject<{
    path: z.ZodOptional<z.ZodString>;
    recursive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    path?: string | undefined;
    recursive?: boolean | undefined;
}, {
    path?: string | undefined;
    recursive?: boolean | undefined;
}>;
export declare function listFiles(args: z.infer<typeof listFilesSchema>): Promise<ToolResult>;
//# sourceMappingURL=file.d.ts.map