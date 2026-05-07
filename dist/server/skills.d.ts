/**
 * Skill loading for the OpenRouter adapter.
 *
 * Reads SKILL.md files from a skills directory and returns their contents
 * for injection into the system prompt.
 *
 * Discovery order for the skills root:
 *   1. agentConfig.skillsDir (per-agent override)
 *   2. PAPERCLIP_SKILLS_DIR env var (server-wide override)
 *   3. ~/.openrouter-adapter/skills (default managed root)
 *
 * v1 design: scan the root, load every subdirectory that contains a SKILL.md,
 * inject all of them. We do NOT yet integrate with Paperclip's "desired skills"
 * registry — that requires API access and is deferred to v3. For now, the
 * operator controls which skills an agent gets by what they put in the
 * skills directory.
 *
 * Failure mode: best-effort. Missing directory or unreadable files log a
 * warning and return what we have. Skill loading never fails the run.
 */
import type { OnLog } from "./transcript.js";
export interface LoadedSkill {
    name: string;
    path: string;
    content: string;
}
export interface LoadSkillsParams {
    agentConfig: Record<string, unknown>;
    onLog: OnLog;
}
export declare function loadSkills(params: LoadSkillsParams): Promise<LoadedSkill[]>;
/**
 * Render loaded skills as a single block of text suitable for prepending to
 * the system prompt. Each skill is wrapped in a fenced section so the model
 * can tell where one ends and the next begins.
 */
export declare function renderSkillsForPrompt(skills: LoadedSkill[]): string;
//# sourceMappingURL=skills.d.ts.map