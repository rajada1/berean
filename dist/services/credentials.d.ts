export interface Config {
    default_model?: string;
    language?: string;
    azure_devops_pat?: string;
    [key: string]: string | undefined;
}
/**
 * Get GitHub token from environment variables (SDK priority order)
 * Also checks Azure DevOps variable naming conventions
 */
export declare function getGitHubToken(): string | null;
/**
 * Get Azure DevOps PAT from env or config
 */
export declare function getAzureDevOpsPAT(): string | null;
/**
 * Get default model from env or config
 * Priority: BEREAN_MODEL → BEREAN.MODEL (Azure DevOps format) → config file → 'gpt-4o'
 *
 * Azure DevOps transforms variable names:
 *   - Pipeline variable "BEREAN_MODEL" → env var "BEREAN_MODEL"
 *   - Pipeline variable "berean.model" → env var "BEREAN_MODEL" (dots→underscores, uppercased)
 *   - Variable group "BereanModel" → env var "BEREANMODEL"
 */
export declare function getDefaultModel(): string;
/**
 * Get the source of the current model config (for display)
 */
export declare function getDefaultModelSource(): string;
/**
 * Get default language from env or config
 * Priority: BEREAN_LANGUAGE → BEREANLANGUAGE → config file → 'English'
 */
export declare function getDefaultLanguage(): string;
/**
 * Get the source of the current language config (for display)
 */
export declare function getDefaultLanguageSource(): string;
/**
 * Get rules file path from env or config
 * Priority: BEREAN_RULES → BEREANRULES → config file → null
 */
export declare function getRulesPath(): string | null;
/**
 * Get GitHub token - also checks Azure DevOps common variable names
 */
export declare function getGitHubTokenFromAzure(): string | null;
/**
 * Get Azure DevOps PAT - also checks Azure pipeline system token
 */
export declare function getAzureDevOpsPATFromPipeline(): string | null;
export declare function getConfig(): Config;
export declare function saveConfig(config: Partial<Config>): void;
export declare function getConfigDir(): string;
export declare function clearCredentials(): void;
//# sourceMappingURL=credentials.d.ts.map