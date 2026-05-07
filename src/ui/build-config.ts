// ─────────────────────────────────────────────────────────────────
// paperclip-adapter-llm — UI Build Config
// Converts onboarding/settings form values → adapterConfig JSON
// ─────────────────────────────────────────────────────────────────

export interface LlmFormValues {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  systemPrompt?: string;
  temperature?: string;
  maxTokens?: string;
  topP?: string;
  stream?: string | boolean;
  reasoning?: string | boolean;
  transforms?: string;
  route?: string;
  httpReferer?: string;
  xTitle?: string;
}

/** @deprecated Use LlmFormValues. */
export type OpenRouterFormValues = LlmFormValues;

/**
 * Convert UI form values into the adapterConfig object
 * stored in the Paperclip database for this agent.
 */
export function buildConfig(
  formValues: LlmFormValues
): Record<string, unknown> {
  const config: Record<string, unknown> = {};

  // Base URL — optional, only persisted when set
  if (formValues.baseUrl) {
    const trimmed = formValues.baseUrl.trim();
    if (trimmed) config.baseUrl = trimmed;
  }

  // Required
  config.model = formValues.model || "openrouter/auto";

  // API key (stored as secret via Paperclip's secret provider)
  if (formValues.apiKey) {
    config.apiKey = formValues.apiKey;
  }

  // Optional text fields
  if (formValues.systemPrompt) {
    config.systemPrompt = formValues.systemPrompt;
  }

  // Numeric fields
  if (formValues.temperature !== undefined && formValues.temperature !== "") {
    config.temperature = parseFloat(formValues.temperature);
  }
  if (formValues.maxTokens !== undefined && formValues.maxTokens !== "") {
    config.maxTokens = parseInt(formValues.maxTokens, 10);
  }
  if (formValues.topP !== undefined && formValues.topP !== "") {
    config.topP = parseFloat(formValues.topP);
  }

  // Boolean fields
  config.stream = formValues.stream === true || formValues.stream === "true";
  if (formValues.reasoning === true || formValues.reasoning === "true") {
    config.reasoning = true;
  }

  // Transforms (comma-separated string → array; OpenRouter-only)
  if (formValues.transforms) {
    config.transforms = formValues.transforms
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  // Route (OpenRouter-only)
  if (formValues.route && ["fallback", "no-fallback"].includes(formValues.route)) {
    config.route = formValues.route;
  }

  // Leaderboard attribution (OpenRouter-only)
  if (formValues.httpReferer) config.httpReferer = formValues.httpReferer;
  if (formValues.xTitle) config.xTitle = formValues.xTitle;

  return config;
}

/**
 * Define the config form fields for Paperclip's UI.
 * Each field maps to a form input in the agent configuration panel.
 */
export const configFields = [
  {
    key: "baseUrl",
    label: "Base URL",
    type: "text" as const,
    placeholder: "https://openrouter.ai/api/v1",
    required: false,
    helpText:
      "OpenAI-compatible endpoint. Leave empty for OpenRouter. Examples: NVIDIA NIM (https://integrate.api.nvidia.com/v1), Ollama (http://localhost:11434/v1).",
  },
  {
    key: "apiKey",
    label: "API Key",
    type: "password" as const,
    placeholder: "sk-or-v1-... / nvapi-... / sk-...",
    required: false,
    helpText:
      "Provider API key. OpenRouter: https://openrouter.ai/keys. NVIDIA NIM: nvapi-... key. Ollama/vLLM localhost: leave empty.",
  },
  {
    key: "model",
    label: "Model",
    type: "select" as const,
    placeholder: "openrouter/auto",
    required: true,
    helpText:
      'Select a model or use "openrouter/auto" for OpenRouter auto-routing. Models are loaded dynamically from /models.',
    dynamic: true, // signals UI to fetch models from test() endpoint
  },
  {
    key: "systemPrompt",
    label: "System Prompt",
    type: "textarea" as const,
    placeholder: "You are a helpful assistant working for {{company_name}}...",
    required: false,
  },
  {
    key: "temperature",
    label: "Temperature",
    type: "number" as const,
    placeholder: "0.7",
    required: false,
    min: 0,
    max: 2,
    step: 0.1,
  },
  {
    key: "maxTokens",
    label: "Max Tokens",
    type: "number" as const,
    placeholder: "4096",
    required: false,
    min: 1,
    max: 200000,
  },
  {
    key: "stream",
    label: "Enable Streaming",
    type: "toggle" as const,
    defaultValue: true,
  },
  {
    key: "reasoning",
    label: "Enable Reasoning (extended thinking)",
    type: "toggle" as const,
    defaultValue: false,
    helpText: "Only works with models that support reasoning (DeepSeek R1, QwQ, etc.)",
  },
  {
    key: "route",
    label: "Routing Strategy (OpenRouter only)",
    type: "select" as const,
    options: [
      { value: "fallback", label: "Fallback (auto-retry with other providers)" },
      { value: "no-fallback", label: "No Fallback (single provider only)" },
    ],
    defaultValue: "fallback",
  },
];
