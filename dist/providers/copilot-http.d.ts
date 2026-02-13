/**
 * Direct HTTP provider for GitHub Copilot API
 * Bypasses the SDK/CLI subprocess for environments where it doesn't work (CI/CD)
 *
 * Flow: GitHub PAT → Copilot token exchange → Chat Completions API
 */
/**
 * Call Copilot Chat Completions API directly via HTTP
 */
export declare function chatCompletion(githubToken: string, model: string, prompt: string, timeoutMs?: number): Promise<string>;
//# sourceMappingURL=copilot-http.d.ts.map