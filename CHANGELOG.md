# Changelog

All notable changes to this project are documented here.

## 0.2.0 — 2026-05-07

Fix API drift against `@paperclipai/adapter-utils` 2026.428.0; add fallback for `skillsDir`; integration test for prompt-build path.

### Fixed
- `src/server/execute.ts`: replaced calls to `api.updateIssueState` and `api.addComment` (removed in adapter-utils 2026.x) with the current `api.updateIssue(id, { status })` and `api.addIssueComment(id, { body })` methods.
- `AdapterExecutionResult` shape: removed `status` field; populate the required `exitCode` / `signal` / `timedOut` keys; moved `costUsd` to top level.
- `UsageSummary` shape: dropped `totalTokens` and `costUsd` (current shape is `inputTokens` / `outputTokens` / `cachedInputTokens?`).
- `renderPaperclipWakePrompt` is no longer called with `skillsPrompt` / `supportsImages` (removed); skills are now prepended manually to the wake prompt.
- `emitInit` now passes `sessionId` (was missing); `emitToolCall` uses `{ name, input, toolUseId }` (was `{ id, name, arguments }`); `emitToolResult` drops `durationMs`.
- `AdapterExecutionContext` is no longer treated as generic; the wake payload and `issueId` are extracted from `ctx.context` defensively.
- `PaperclipApi` constructor now receives `{ authToken }` (was the entire ctx, which silently shadowed the real shape).
- `src/server/skills.ts`: `loadSkills` guards against an undefined `agentConfig`; default skills directory is now `~/.paperclip-llm-adapter/skills` (was `~/.openrouter-adapter/skills`); exports `defaultSkillsDir()` plus `DEFAULT_SKILLS_DIR` for callers needing the literal path.

### Added
- `PAPERCLIP_LLM_CLI_PATH` environment variable to override the bundled CLI path (used by integration tests).
- `tests/execute.test.ts` integration test covering: prompt build with no `skillsDir`, `updateIssue` / `addIssueComment` invocation, current `AdapterExecutionResult` schema (no removed fields), CLI failure marks the issue `blocked`, non-OpenRouter `baseUrl` does not throw on `/generation` 404.
- `npm test` script powered by vitest 3.

### Changed
- Bumped to `0.2.0`. Backwards-compat exports preserved: `OpenRouterConfig` (alias for `LlmConfig`), `OpenRouterFormValues`, `DEFAULT_BASE_URL`, `OPENROUTER_BASE_URL`/`_MODELS_ENDPOINT`/`_CHAT_ENDPOINT`/`_GENERATION_ENDPOINT`, `listOpenRouterModels`, `openrouter-cli` bin.

## 0.1.0 — 2026-05-06

- Forked from `talhamahmood666/paperclip-adapter-openrouter`.
- Generalized OpenRouter base URL into `adapterConfig.baseUrl` so the adapter targets any OpenAI-compatible endpoint (OpenRouter, NVIDIA NIM, Ollama, vLLM, DeepSeek direct).
- Added `resolveEndpoints()`, `isOpenRouter()`, `isLocalEndpoint()`, `LlmConfig`, `LlmFormValues`.
- CLI: `--base-url` flag, `LLM_BASE_URL` env var, `LLM_API_KEY` env var; `createOpenRouter({ apiKey, baseURL })` wires the configured endpoint into chat completions.
- UI: `Base URL` text field with multi-provider help text.
- README rewritten with concrete config blocks for OpenRouter, NIM, Ollama, vLLM, DeepSeek.
