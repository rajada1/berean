import { 
  getOAuthToken, 
  saveCredentials, 
  getCopilotToken,
  saveCopilotToken 
} from './credentials.js';

// GitHub OAuth App Client ID (same as VS Code Copilot extension)
const GITHUB_CLIENT_ID = 'Iv1.b507a08c87ecfe98';

// API endpoints
const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_OAUTH_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const COPILOT_TOKEN_URL = 'https://api.github.com/copilot_internal/v2/token';

export interface DeviceFlowResponse {
  userCode: string;
  verificationUri: string;
  deviceCode: string;
  expiresIn: number;
  interval: number;
}

export interface CopilotCredentials {
  token: string;
  endpoint: string;
  expiresAt: number;
}

/**
 * Start the GitHub Device Flow OAuth process
 */
export async function startDeviceFlow(): Promise<DeviceFlowResponse> {
  const response = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Berean/1.0.0'
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      scope: 'read:user'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to start device flow: ${error}`);
  }

  const data = await response.json() as {
    user_code: string;
    verification_uri: string;
    device_code: string;
    expires_in: number;
    interval?: number;
  };

  return {
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    deviceCode: data.device_code,
    expiresIn: data.expires_in,
    interval: data.interval || 5
  };
}

/**
 * Poll for OAuth token after user authorizes
 */
export async function pollForOAuthToken(
  deviceCode: string, 
  interval: number = 5,
  maxAttempts: number = 60,
  onPoll?: () => void
): Promise<string> {
  let currentInterval = interval;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(currentInterval * 1000);
    
    if (onPoll) onPoll();

    try {
      const response = await fetch(GITHUB_OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Berean/1.0.0'
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });

      const data = await response.json() as {
        access_token?: string;
        error?: string;
        error_description?: string;
        interval?: number;
      };

      if (data.access_token) {
        // Save OAuth token
        saveCredentials({ github_oauth_token: data.access_token });
        return data.access_token;
      }

      if (data.error === 'authorization_pending') {
        continue;
      }

      if (data.error === 'slow_down') {
        currentInterval = (data.interval || currentInterval) + 5;
        continue;
      }

      if (data.error === 'expired_token') {
        throw new Error('Authorization expired. Please try again.');
      }

      if (data.error === 'access_denied') {
        throw new Error('Authorization denied by user.');
      }

      if (data.error) {
        throw new Error(data.error_description || data.error);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Authorization')) {
        throw error;
      }
      // Network error, continue polling
    }
  }

  throw new Error('Authorization timeout. Please try again.');
}

/**
 * Get API token from Copilot service
 */
export async function fetchCopilotToken(oauthToken: string): Promise<CopilotCredentials> {
  const response = await fetch(COPILOT_TOKEN_URL, {
    method: 'GET',
    headers: {
      'Authorization': `token ${oauthToken}`,
      'Accept': 'application/json',
      'User-Agent': 'Berean/1.0.0'
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('GitHub session expired. Please run: berean auth login');
    }
    
    if (response.status === 403) {
      throw new Error('No active Copilot subscription found.');
    }
    
    const error = await response.text();
    throw new Error(`Failed to get Copilot token: ${error}`);
  }

  const data = await response.json() as {
    token: string;
    expires_at: number;
    endpoints?: { api?: string };
  };

  const credentials: CopilotCredentials = {
    token: data.token,
    endpoint: data.endpoints?.api || 'https://api.githubcopilot.com',
    expiresAt: data.expires_at * 1000 // Convert to milliseconds
  };

  // Cache the token
  saveCopilotToken(credentials.token, credentials.endpoint, credentials.expiresAt);

  return credentials;
}

/**
 * Get valid Copilot credentials (refreshing if needed)
 */
export async function getValidCopilotCredentials(): Promise<CopilotCredentials> {
  const oauthToken = getOAuthToken();
  
  if (!oauthToken) {
    throw new Error('Not authenticated. Run: berean auth login');
  }

  const cached = getCopilotToken();
  const now = Date.now();
  const bufferMs = 5 * 60 * 1000; // 5 minutes

  // Return cached if still valid
  if (cached && cached.expiresAt > (now + bufferMs)) {
    return cached;
  }

  // Refresh token
  return await fetchCopilotToken(oauthToken);
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getOAuthToken();
}

/**
 * Get auth status with details
 */
export async function getAuthStatus(): Promise<{
  authenticated: boolean;
  hasSubscription: boolean;
  error?: string;
}> {
  const oauthToken = getOAuthToken();
  
  if (!oauthToken) {
    return { authenticated: false, hasSubscription: false };
  }

  try {
    await getValidCopilotCredentials();
    return { authenticated: true, hasSubscription: true };
  } catch (error) {
    return {
      authenticated: true,
      hasSubscription: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
