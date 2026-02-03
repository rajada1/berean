import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.berean');
const CREDENTIALS_FILE = path.join(CONFIG_DIR, 'credentials.json');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface Credentials {
  github_oauth_token?: string;
  azure_devops_pat?: string;
  copilot_token?: string;
  copilot_endpoint?: string;
  copilot_expires_at?: number;
}

export interface Config {
  default_model?: string;
  language?: string;
}

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

export function getCredentials(): Credentials {
  ensureConfigDir();
  
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    return {};
  }
  
  try {
    const content = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export function saveCredentials(credentials: Credentials): void {
  ensureConfigDir();
  
  const existing = getCredentials();
  const merged = { ...existing, ...credentials };
  
  fs.writeFileSync(
    CREDENTIALS_FILE,
    JSON.stringify(merged, null, 2),
    { mode: 0o600 }
  );
}

export function clearCredentials(): void {
  if (fs.existsSync(CREDENTIALS_FILE)) {
    fs.unlinkSync(CREDENTIALS_FILE);
  }
}

export function getOAuthToken(): string | null {
  // Priority: env var > file
  if (process.env.GITHUB_OAUTH_TOKEN) {
    return process.env.GITHUB_OAUTH_TOKEN;
  }
  
  const creds = getCredentials();
  return creds.github_oauth_token || null;
}

export function getAzureDevOpsPAT(): string | null {
  // Priority: env var > file
  if (process.env.AZURE_DEVOPS_PAT) {
    return process.env.AZURE_DEVOPS_PAT;
  }
  
  const creds = getCredentials();
  return creds.azure_devops_pat || null;
}

export function getCopilotToken(): { token: string; endpoint: string; expiresAt: number } | null {
  const creds = getCredentials();
  
  if (!creds.copilot_token || !creds.copilot_endpoint || !creds.copilot_expires_at) {
    return null;
  }
  
  return {
    token: creds.copilot_token,
    endpoint: creds.copilot_endpoint,
    expiresAt: creds.copilot_expires_at
  };
}

export function saveCopilotToken(token: string, endpoint: string, expiresAt: number): void {
  saveCredentials({
    copilot_token: token,
    copilot_endpoint: endpoint,
    copilot_expires_at: expiresAt
  });
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
    JSON.stringify(merged, null, 2)
  );
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}
