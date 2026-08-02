/**
 * AI/ML model configuration and SSE streaming type contracts for Enterprise
 * AI/ML dashboards. Matches `docs/TYPESCRIPT.md` Phase 1.
 */
/**
 * Immutable model configuration passed to the inference runtime.
 * `modelId`, `temperature`, `topP`, and `maxTokens` are required.
 */
export interface ModelConfig {
    /** Model identifier, e.g. 'deepseek-chat'. */
    readonly modelId: string;
    /** Sampling temperature in [0, 2]. */
    readonly temperature: number;
    /** Nucleus sampling cutoff in (0, 1]. */
    readonly topP: number;
    /** Maximum number of output tokens. */
    readonly maxTokens: number;
    /** Presence penalty in [-2, 2]. */
    readonly presencePenalty?: number;
    /** Frequency penalty in [-2, 2]. */
    readonly frequencyPenalty?: number;
    /** Structured output mode. */
    readonly responseFormat?: {
        readonly type: 'json_object' | 'text';
    };
    /** Function-calling tool definitions. */
    readonly tools?: ReadonlyArray<{
        readonly name: string;
        readonly description: string;
        readonly parameters: Record<string, unknown>;
    }>;
}
/**
 * Discriminated union of server-sent stream events.
 *
 * Narrow on the `type` discriminant; each variant carries only the fields
 * valid for that event kind.
 */
export type SSEStreamEvent = {
    readonly type: 'token_delta';
    readonly text: string;
    readonly tokenCount: number;
} | {
    readonly type: 'tool_call_start';
    readonly toolName: string;
    readonly input: Record<string, unknown>;
} | {
    readonly type: 'vector_search_result';
    readonly chunks: ReadonlyArray<{
        readonly id: string;
        readonly score: number;
        readonly text: string;
    }>;
} | {
    readonly type: 'finish';
    readonly reason: 'stop' | 'length' | 'tool_calls';
    readonly totalTokens: number;
} | {
    readonly type: 'error';
    readonly code: string;
    readonly message: string;
};
//# sourceMappingURL=aiml.d.ts.map