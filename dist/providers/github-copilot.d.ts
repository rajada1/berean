export interface ReviewIssue {
    severity: 'critical' | 'warning' | 'suggestion';
    file?: string;
    line?: number;
    message: string;
    suggestion?: string;
}
export interface ReviewResult {
    success: boolean;
    review?: string;
    summary?: string;
    issues?: ReviewIssue[];
    positives?: string[];
    recommendations?: string[];
    error?: string;
    model?: string;
}
export interface ReviewOptions {
    model?: string;
    language?: string;
    maxTokens?: number;
    rules?: string;
}
/**
 * Cleanup client on exit
 */
export declare function stopClient(): Promise<void>;
/**
 * Review code using GitHub Copilot SDK
 */
export declare function reviewCode(diff: string, options?: ReviewOptions): Promise<ReviewResult>;
export interface ModelDetail {
    id: string;
    name: string;
    isDefault: boolean;
    isPremium?: boolean;
    multiplier?: number;
    maxContextTokens?: number;
    maxOutputTokens?: number;
    supportsVision?: boolean;
    supportsToolCalls?: boolean;
    supportsStreaming?: boolean;
    supportsReasoning?: boolean;
    reasoningEfforts?: string[];
    defaultReasoningEffort?: string;
    policyState?: string;
}
/**
 * Fetch available models from Copilot SDK (real API call)
 * Falls back to a hardcoded list if the API call fails
 */
export declare function fetchModels(): Promise<ModelDetail[]>;
//# sourceMappingURL=github-copilot.d.ts.map