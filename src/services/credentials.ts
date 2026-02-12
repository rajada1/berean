import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.berean');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface Config {
  default_model?: string;
  language?: string;
  azure_devops_pat?: string;
  [key: string]: string | undefined;
}

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Get GitHub token from environment variables (SDK priority order)
 * The SDK itself also reads these, but we check them for auth status display
 */
export function getGitHubToken(): string | null {
  return process.env.COPILOT_GITHUB_TOKEN 
    || process.env.GH_TOKEN 
    || process.env.GITHUB_TOKEN 
    || null;
}

/**
 * Get Azure DevOps PAT from env or config
 */
export function getAzureDevOpsPAT(): string | null {
  if (process.env.AZURE_DEVOPS_PAT) {
    return process.env.AZURE_DEVOPS_PAT;
  }
  
  const config = getConfig();
  return config.azure_devops_pat || null;
}

/**
 * Get default model from env or config
 * Priority: BEREAN_MODEL env var → config file → 'gpt-4o'
 */
export function getDefaultModel(): string {
  return process.env.BEREAN_MODEL 
    || getConfig().default_model 
    || 'gpt-4o';
}

/**
 * Get default language from env or config
 * Priority: BEREAN_LANGUAGE env var → config file → 'English'
 */
export function getDefaultLanguage(): string {
  return process.env.BEREAN_LANGUAGE 
    || getConfig().language 
    || 'English';
}

export function getConfig(): Config {
  ensureConfigDir();
  
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }
  
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export function saveConfig(config: Partial<Config>): void {
  ensureConfigDir();
  
  const existing = getConfig();
  const merged = { ...existing, ...config };
  
  fs.writeFileSync(
    CONFIG_FILE,
    JSON.stringify(merged, null, 2),
    { mode: 0o600 }
  );
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

// Legacy compat - clear old credentials file if it exists
export function clearCredentials(): void {
  const credFile = path.join(CONFIG_DIR, 'credentials.json');
  if (fs.existsSync(credFile)) {
    fs.unlinkSync(credFile);
  }
}
