interface FormatOptions {
    verbose?: boolean;
}
/**
 * Format a single stdout line for terminal display.
 * Called by Paperclip CLI's --watch mode.
 */
export declare function formatEvent(line: string, _opts?: FormatOptions): string | null;
/**
 * Format a run summary for terminal display.
 */
export declare function formatRunSummary(result: {
    success: boolean;
    usage?: {
        inputTokens: number;
        outputTokens: number;
        costUsd: number;
    };
    metadata?: Record<string, unknown>;
}): string;
export {};
//# sourceMappingURL=format-event.d.ts.map