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
/**
 * Fetch available models from Copilot SDK
 */
export declare function fetchModels(): Promise<Array<{
    id: string;
    name: string;
    isDefault: boolean;
}>>;
//# sourceMappingURL=github-copilot.d.ts.map