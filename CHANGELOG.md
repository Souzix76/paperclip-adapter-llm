# Changelog

## [0.2.2] - 2026-05-07

### Fixed
- CLI: chat completions against non-OpenRouter providers (NVIDIA NIM, vLLM,
  Ollama, DeepSeek direct) crashed at `cli/dist/agent.js:32` with
  `TypeError: Cannot read properties of undefined (reading 'content')` because
  the `ai` SDK's `response.messages[0]` is only populated when the request
  goes through OpenRouter's framing. The CLI now reads tool calls and text
  from `result.fullStream` and reconstructs the assistant message from those
  chunks, so it no longer touches `response.messages`. Reported in #2.
- `cli/src/openrouter.ts` switched from `result.textStream` to
  `result.fullStream` and now yields `tool-call` chunks during the stream.

### Added
- `tests/cli-agent.test.ts` — regression specs that mock `streamResponse` to
  return text deltas with no `messages[0]` (NIM/vLLM shape) and assert
  `runAgent` does not throw and emits `assistant` + `done` events.
- `tests/entry-point.test.ts` — smoke specs that import `dist/index.js`
  and assert `createServerAdapter()` exists, returns the
  `ServerAdapterModule` shape (`type` / `label` / `models` /
  `agentConfigurationDoc` / `execute` / `testEnvironment`), and that
  `resolveEndpoints()` is exported. Guards against future entry-point
  refactors silently regressing 0.2.1's fix.

## [0.2.1] - 2026-05-07

### Fixed
- Restore `createServerAdapter` re-export on the package main entry
  (`src/index.ts` → `dist/index.js`). The 0.2.0 refactor regressed the
  fix from commit `6fb8f95`, causing the Paperclip plugin loader to
  reject the package at runtime with: *"Package does not export
  createServerAdapter()"*. Empirically reproduced on Paperclip
  v2026.428.0 (Contabo VPS). After this patch, server startup logs
  `Loaded external adapters from plugin store {"count":1,"adapters":["llm"]}`.

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
