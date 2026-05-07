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
export declare function buildConfig(formValues: LlmFormValues): Record<string, unknown>;
/**
 * Define the config form fields for Paperclip's UI.
 * Each field maps to a form input in the agent configuration panel.
 */
export declare const configFields: ({
    key: string;
    label: string;
    type: "text";
    placeholder: string;
    required: boolean;
    helpText: string;
    dynamic?: undefined;
    min?: undefined;
    max?: undefined;
    step?: undefined;
    defaultValue?: undefined;
    options?: undefined;
} | {
    key: string;
    label: string;
    type: "password";
    placeholder: string;
    required: boolean;
    helpText: string;
    dynamic?: undefined;
    min?: undefined;
    max?: undefined;
    step?: undefined;
    defaultValue?: undefined;
    options?: undefined;
} | {
    key: string;
    label: string;
    type: "select";
    placeholder: string;
    required: boolean;
    helpText: string;
    dynamic: boolean;
    min?: undefined;
    max?: undefined;
    step?: undefined;
    defaultValue?: undefined;
    options?: undefined;
} | {
    key: string;
    label: string;
    type: "textarea";
    placeholder: string;
    required: boolean;
    helpText?: undefined;
    dynamic?: undefined;
    min?: undefined;
    max?: undefined;
    step?: undefined;
    defaultValue?: undefined;
    options?: undefined;
} | {
    key: string;
    label: string;
    type: "number";
    placeholder: string;
    required: boolean;
    min: number;
    max: number;
    step: number;
    helpText?: undefined;
    dynamic?: undefined;
    defaultValue?: undefined;
    options?: undefined;
} | {
    key: string;
    label: string;
    type: "number";
    placeholder: string;
    required: boolean;
    min: number;
    max: number;
    helpText?: undefined;
    dynamic?: undefined;
    step?: undefined;
    defaultValue?: undefined;
    options?: undefined;
} | {
    key: string;
    label: string;
    type: "toggle";
    defaultValue: boolean;
    placeholder?: undefined;
    required?: undefined;
    helpText?: undefined;
    dynamic?: undefined;
    min?: undefined;
    max?: undefined;
    step?: undefined;
    options?: undefined;
} | {
    key: string;
    label: string;
    type: "toggle";
    defaultValue: boolean;
    helpText: string;
    placeholder?: undefined;
    required?: undefined;
    dynamic?: undefined;
    min?: undefined;
    max?: undefined;
    step?: undefined;
    options?: undefined;
} | {
    key: string;
    label: string;
    type: "select";
    options: {
        value: string;
        label: string;
    }[];
    defaultValue: string;
    placeholder?: undefined;
    required?: undefined;
    helpText?: undefined;
    dynamic?: undefined;
    min?: undefined;
    max?: undefined;
    step?: undefined;
})[];
//# sourceMappingURL=build-config.d.ts.map