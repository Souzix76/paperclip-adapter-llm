/**
 * Typed TranscriptEntry emitters.
 *
 * Paperclip's run viewer expects each transcript entry as a single-line JSON
 * object on stdout. The UI's parseStdout module turns those lines into
 * TranscriptEntry objects (see adapter-utils/types.ts).
 *
 * Every emit() call writes exactly one line ending in "\n".
 *
 * Why a wrapper instead of inline JSON.stringify everywhere:
 *   - guarantees the entry shape matches the discriminated union
 *   - one place to add tracing / debug prefixes later
 *   - prevents accidentally splitting an entry across two onLog calls
 */
export type OnLog = (stream: "stdout" | "stderr", chunk: string) => Promise<void>;
export declare function emitInit(onLog: OnLog, params: {
    model: string;
    sessionId: string;
}): Promise<void>;
export declare function emitAssistant(onLog: OnLog, text: string, opts?: {
    delta?: boolean;
}): Promise<void>;
export declare function emitThinking(onLog: OnLog, text: string, opts?: {
    delta?: boolean;
}): Promise<void>;
export declare function emitToolCall(onLog: OnLog, params: {
    name: string;
    input: unknown;
    toolUseId?: string;
}): Promise<void>;
export declare function emitToolResult(onLog: OnLog, params: {
    toolUseId: string;
    toolName?: string;
    content: string;
    isError: boolean;
}): Promise<void>;
export declare function emitResult(onLog: OnLog, params: {
    text: string;
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
    costUsd?: number;
    subtype?: string;
    isError?: boolean;
    errors?: string[];
}): Promise<void>;
export declare function emitSystem(onLog: OnLog, text: string): Promise<void>;
export declare function emitStderr(onLog: OnLog, text: string): Promise<void>;
/**
 * Raw stderr write — bypasses the JSON envelope. Use for adapter-level
 * diagnostics that should appear in the run log but not in the transcript.
 */
export declare function writeRawStderr(onLog: OnLog, text: string): Promise<void>;
//# sourceMappingURL=transcript.d.ts.map