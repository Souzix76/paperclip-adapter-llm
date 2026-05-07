/**
 * Smoke tests for the package main entry. Without these, future entry-point
 * refactors silently regress fixes shipped in 0.2.1 (createServerAdapter
 * re-export) and earlier (type/label/models/agentConfigurationDoc on the
 * createServerAdapter() return).
 *
 * Per Paperclip's plugin loader contract, the package's main export must
 * provide createServerAdapter() and the result must satisfy
 * ServerAdapterModule (type + execute + testEnvironment, plus the optional
 * fields the UI relies on: models, agentConfigurationDoc, label).
 */

import { describe, expect, it } from "vitest";

describe("package main entry", () => {
  it("exports createServerAdapter() from dist/index.js", async () => {
    const mod: Record<string, unknown> = await import("../dist/index.js");
    expect(typeof mod.createServerAdapter).toBe("function");
  });

  it("createServerAdapter() returns a ServerAdapterModule with the expected fields", async () => {
    const mod: any = await import("../dist/index.js");
    const adapter = mod.createServerAdapter();
    expect(adapter.type).toBe("llm");
    expect(typeof adapter.label).toBe("string");
    expect(Array.isArray(adapter.models)).toBe(true);
    expect(typeof adapter.agentConfigurationDoc).toBe("string");
    expect(typeof adapter.execute).toBe("function");
    expect(typeof adapter.testEnvironment).toBe("function");
  });

  it("re-exports the resolveEndpoints helper", async () => {
    const mod: any = await import("../dist/index.js");
    expect(typeof mod.resolveEndpoints).toBe("function");
    expect(mod.resolveEndpoints().base).toBe("https://openrouter.ai/api/v1");
  });
});
