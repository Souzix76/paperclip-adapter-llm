import type { AdapterEnvironmentTestContext, AdapterEnvironmentTestResult } from "@paperclipai/adapter-utils";
export declare function testEnvironment(ctx: AdapterEnvironmentTestContext): Promise<AdapterEnvironmentTestResult>;
/**
 * Fetch all models from the configured endpoint — used by listModels()
 * for dynamic model picker.
 */
export declare function listModels(baseUrl?: string): Promise<{
    id: string;
    label: string;
}[]>;
/** @deprecated Use listModels(baseUrl). */
export declare const listOpenRouterModels: typeof listModels;
//# sourceMappingURL=test.d.ts.map