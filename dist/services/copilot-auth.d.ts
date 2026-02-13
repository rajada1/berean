/**
 * Check if user is authenticated (has a GitHub token available)
 */
export declare function isAuthenticated(): boolean;
/**
 * Get auth status with details
 */
export declare function getAuthStatus(): Promise<{
    authenticated: boolean;
    method: 'env' | 'cli' | 'none';
    token?: string;
    error?: string;
}>;
/**
 * Login via copilot CLI (interactive)
 */
export declare function loginViaCLI(): void;
/**
 * Logout via copilot CLI
 */
export declare function logoutViaCLI(): void;
//# sourceMappingURL=copilot-auth.d.ts.map