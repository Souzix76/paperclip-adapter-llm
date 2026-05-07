export interface TranscriptEntry {
    type: "text" | "thinking" | "tool_call" | "tool_result" | "error" | "info";
    content: string;
    timestamp?: number;
    metadata?: Record<string, unknown>;
}
/**
 * Parse stdout lines from an OpenRouter adapter run into
 * transcript entries for Paperclip's run viewer UI.
 */
export declare function parseStdout(stdout: string): TranscriptEntry[];
//# sourceMappingURL=parse-stdout.d.ts.map