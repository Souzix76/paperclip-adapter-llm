/**
 * OpenRouter adapter execute() — thin proxy to openrouter-cli.
 *
 * Responsibilities:
 *   - Build prompt from Paperclip wake context + skills
 *   - Spawn openrouter-cli with the prompt
 *   - Map CLI's stream-json events to Paperclip TranscriptEntry
 *   - Manage issue state (in_progress at start, done/blocked at end)
 *   - Post the final assistant output as an issue comment
 */
import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import { type LlmConfig } from "../index.js";
export declare function execute(ctx: AdapterExecutionContext<LlmConfig>): Promise<AdapterExecutionResult>;
//# sourceMappingURL=execute.d.ts.map