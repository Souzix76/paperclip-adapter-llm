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
function nowIso() {
    return new Date().toISOString();
}
async function emit(onLog, entry) {
    await onLog("stdout", `${JSON.stringify(entry)}\n`);
}
export async function emitInit(onLog, params) {
    await emit(onLog, {
        kind: "init",
        ts: nowIso(),
        model: params.model,
        sessionId: params.sessionId,
    });
}
export async function emitAssistant(onLog, text, opts = {}) {
    await emit(onLog, {
        kind: "assistant",
        ts: nowIso(),
        text,
        delta: opts.delta ?? false,
    });
}
export async function emitThinking(onLog, text, opts = {}) {
    await emit(onLog, {
        kind: "thinking",
        ts: nowIso(),
        text,
        delta: opts.delta ?? false,
    });
}
export async function emitToolCall(onLog, params) {
    await emit(onLog, {
        kind: "tool_call",
        ts: nowIso(),
        name: params.name,
        input: params.input,
        toolUseId: params.toolUseId,
    });
}
export async function emitToolResult(onLog, params) {
    await emit(onLog, {
        kind: "tool_result",
        ts: nowIso(),
        toolUseId: params.toolUseId,
        toolName: params.toolName,
        content: params.content,
        isError: params.isError,
    });
}
export async function emitResult(onLog, params) {
    await emit(onLog, {
        kind: "result",
        ts: nowIso(),
        text: params.text,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        cachedTokens: params.cachedTokens ?? 0,
        costUsd: params.costUsd ?? 0,
        subtype: params.subtype ?? "success",
        isError: params.isError ?? false,
        errors: params.errors ?? [],
    });
}
export async function emitSystem(onLog, text) {
    await emit(onLog, { kind: "system", ts: nowIso(), text });
}
export async function emitStderr(onLog, text) {
    // stderr entries also live in the transcript union; they go on stdout as JSON
    // (the actual stderr stream is reserved for raw adapter diagnostics).
    await emit(onLog, { kind: "stderr", ts: nowIso(), text });
}
/**
 * Raw stderr write — bypasses the JSON envelope. Use for adapter-level
 * diagnostics that should appear in the run log but not in the transcript.
 */
export async function writeRawStderr(onLog, text) {
    await onLog("stderr", text.endsWith("\n") ? text : `${text}\n`);
}
//# sourceMappingURL=transcript.js.map