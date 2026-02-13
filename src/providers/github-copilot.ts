import { CopilotClient } from '@github/copilot-sdk';
import { getGitHubTokenFromAzure } from '../services/credentials.js';

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
  rules?: string; // Custom rules/guidelines content to include in the prompt
}

// Singleton client instance
let _client: CopilotClient | null = null;

/**
 * Get or create a CopilotClient instance
 */
async function getClient(): Promise<CopilotClient> {
  if (_client) return _client;

  const token = getGitHubTokenFromAzure();

  const options: Record<string, unknown> = {};

  if (token) {
    options.githubToken = token;
    options.useLoggedInUser = false;
  }
  // If no token, SDK will try: env vars (COPILOT_GITHUB_TOKEN, GH_TOKEN, GITHUB_TOKEN) → stored CLI credentials → gh auth

  _client = new CopilotClient(options);
  return _client;
}

/**
 * Cleanup client on exit
 */
export async function stopClient(): Promise<void> {
  if (_client) {
    await _client.stop();
    _client = null;
  }
}

// Timeout for sendAndWait (5 minutes for large diffs with rules)
const REVIEW_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Review code using GitHub Copilot SDK
 */
export async function reviewCode(
  diff: string,
  options: ReviewOptions = {}
): Promise<ReviewResult> {
  const { model = 'gpt-4o', language = 'English', rules } = options;

  let session: import('@github/copilot-sdk').CopilotSession | null = null;

  try {
    const client = await getClient();

    const systemPrompt = buildReviewPrompt(language, rules);

    session = await client.createSession({
      model,
      streaming: false,
    });

    // Send system prompt + diff as a review request
    const response = await session.sendAndWait(
      {
        prompt: `${systemPrompt}\n\n---\n\nHere is the code diff to review:\n\n${diff}`,
      },
      REVIEW_TIMEOUT_MS,
    );

    const content = response?.data?.content || '';

    if (!content) {
      return {
        success: false,
        error: 'Empty response from API',
        model
      };
    }

    // Parse the JSON response
    return parseReviewResponse(content, model);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Provide a more helpful message for stream/timeout errors
    if (message.includes('stream was destroyed') || message.includes('timeout')) {
      return {
        success: false,
        error: `Review timed out or connection was lost. The diff may be too large. Try with a smaller PR or increase timeout. (${message})`,
        model
      };
    }

    return {
      success: false,
      error: message,
      model
    };
  } finally {
    // Always cleanup the session
    if (session) {
      try {
        await session.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Parse the AI response into structured review result
 */
function parseReviewResponse(content: string, model: string): ReviewResult {
  try {
    let jsonContent = content;

    // Extract JSON if wrapped in markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    let parsed: {
      summary?: string;
      issues?: ReviewResult['issues'];
      positives?: string[];
      recommendations?: string[];
    } | null = null;

    // First try parsing as-is
    try {
      parsed = JSON.parse(jsonContent);
    } catch {
      // Try to fix truncated JSON
      let fixedJson = jsonContent;

      const openBraces = (fixedJson.match(/{/g) || []).length;
      const closeBraces = (fixedJson.match(/}/g) || []).length;
      const openBrackets = (fixedJson.match(/\[/g) || []).length;
      const closeBrackets = (fixedJson.match(/\]/g) || []).length;

      // Remove trailing incomplete string/value
      fixedJson = fixedJson.replace(/,\s*"[^"]*$/, '');
      fixedJson = fixedJson.replace(/,\s*$/, '');
      fixedJson = fixedJson.replace(/:\s*"[^"]*$/, ': ""');

      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        fixedJson += ']';
      }
      for (let i = 0; i < openBraces - closeBraces; i++) {
        fixedJson += '}';
      }

      try {
        parsed = JSON.parse(fixedJson);
      } catch {
        // Still failed
      }
    }

    if (parsed) {
      return {
        success: true,
        summary: parsed.summary,
        issues: parsed.issues,
        positives: parsed.positives,
        recommendations: parsed.recommendations,
        review: content,
        model
      };
    }

    return {
      success: true,
      review: content,
      model
    };
  } catch {
    return {
      success: true,
      review: content,
      model
    };
  }
}

function buildReviewPrompt(language: string, rules?: string): string {
  let prompt = `You are an expert code reviewer. Analyze the provided code changes (git diff) and provide a comprehensive review.

You MUST respond with ONLY a valid JSON object (no markdown, no code blocks, no extra text). The JSON must contain:

{
  "summary": "Brief summary of what the changes do (2-3 sentences)",
  "issues": [
    {
      "severity": "critical|warning|suggestion",
      "file": "/path/to/file.ts",
      "line": 42,
      "message": "Description of the issue and how to fix it",
      "suggestion": "Optional: corrected code snippet if applicable"
    }
  ],
  "positives": ["List of good practices observed"],
  "recommendations": ["General recommendations for improvement"]
}

CRITICAL RULES:
1. Response must be ONLY the JSON object - no markdown, no \`\`\`json blocks, just raw JSON
2. "file" must be the EXACT file path as shown in the diff (e.g., "/src/services/api.ts")
3. "line" must be a specific line number from the NEW version of the file
4. "issues" array can be empty [] if there are no problems
5. All text content must be in ${language}

Severity levels:
- critical: Security vulnerabilities, bugs that will cause crashes, data loss
- warning: Code smells, potential bugs, performance issues
- suggestion: Style improvements, refactoring opportunities

Be specific and actionable. If the code is good, return empty issues array and list positives.`;

  if (rules) {
    prompt += `\n\n---\n\nPROJECT-SPECIFIC RULES AND GUIDELINES (use these to evaluate the code):\n\n${rules}`;
  }

  return prompt;
}

/**
 * Fetch available models from Copilot SDK
 */
export async function fetchModels(): Promise<Array<{
  id: string;
  name: string;
  isDefault: boolean;
}>> {
  try {
    const client = await getClient();

    const session = await client.createSession({
      model: 'gpt-4o', // temporary session just to list models
    });

    // The SDK exposes models through the client
    // For now, return a curated list of known models
    // The SDK doesn't have a direct listModels method yet,
    // so we'll use the known Copilot models
    const knownModels = [
      { id: 'gpt-4o', name: 'GPT-4o', isDefault: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', isDefault: false },
      { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', isDefault: false },
      { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', isDefault: false },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', isDefault: false },
      { id: 'o3-mini', name: 'o3-mini', isDefault: false },
    ];

    return knownModels;
  } catch {
    // Fallback: return known models without validation
    return [
      { id: 'gpt-4o', name: 'GPT-4o', isDefault: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', isDefault: false },
      { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', isDefault: false },
      { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', isDefault: false },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', isDefault: false },
      { id: 'o3-mini', name: 'o3-mini', isDefault: false },
    ];
  }
}
