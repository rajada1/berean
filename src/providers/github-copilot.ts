import { CopilotClient } from '@github/copilot-sdk';
import { getGitHubTokenFromAzure } from '../services/credentials.js';
import { chatCompletion } from './copilot-http.js';

export interface ReviewIssue {
  severity: 'critical' | 'warning' | 'suggestion';
  category: 'security' | 'bug' | 'performance' | 'error-handling' | 'maintainability' | 'data-integrity' | 'concurrency' | 'resource-leak';
  confidence: number; // 0-100
  file?: string;
  line?: number;
  title: string;
  message: string;
  suggestion?: string;
}

export interface ReviewResult {
  success: boolean;
  review?: string;
  summary?: string;
  recommendation?: 'APPROVE' | 'APPROVE_WITH_SUGGESTIONS' | 'NEEDS_CHANGES' | 'NEEDS_DISCUSSION';
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
  confidenceThreshold?: number; // default 75
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

/**
 * Review code using GitHub Copilot SDK
 */
export async function reviewCode(
  diff: string,
  options: ReviewOptions = {}
): Promise<ReviewResult> {
  const { model = 'gpt-4o', language = 'English', rules } = options;
  const confidenceThreshold = options.confidenceThreshold ?? 75;

  try {
    const client = await getClient();

    const { system, user } = buildReviewPrompt(language, diff, rules);
    const promptSize = system.length + user.length;

    console.error(`[berean] Token source: ${getGitHubTokenFromAzure() ? 'env var' : 'SDK default'}`);
    console.error(`[berean] Node version: ${process.version}`);
    console.error(`[berean] Prompt size: ${promptSize} chars (~${Math.round(promptSize / 4)} tokens)`);
    
    // Quick connectivity test via SDK (30s) — if it fails, go straight to HTTP
    console.error(`[berean] Starting client...`);
    await client.start();
    console.error(`[berean] Client started, testing SDK connectivity...`);
    
    let sdkWorks = false;
    const testSession = await client.createSession({ model, streaming: false });
    try {
      const testResponse = await testSession.sendAndWait({ prompt: 'Reply with just: OK' }, 30_000);
      const testContent = testResponse?.data?.content || '';
      if (testContent) {
        sdkWorks = true;
        console.error(`[berean] ✓ SDK works (test response: ${testContent.substring(0, 20)})`);
      }
    } catch (testErr) {
      console.error(`[berean] ✗ SDK failed: ${testErr instanceof Error ? testErr.message : testErr}`);
    }

    let content = '';
    const TIMEOUT_MS = 300_000; // 5 min

    if (sdkWorks) {
      // SDK works — use it for the real review
      console.error(`[berean] Using SDK for review...`);
      const session = await client.createSession({ model, streaming: false, systemMessage: { content: system } });

      content = await new Promise<string>((resolve, reject) => {
        let result = '';
        let gotMessage = false;
        let settleTimer: ReturnType<typeof setTimeout> | null = null;

        const timeoutId = setTimeout(() => {
          unsubscribe();
          if (gotMessage && result) {
            console.error(`[berean] Timeout reached but got response, using it`);
            resolve(result);
          } else {
            reject(new Error(`No response received after ${TIMEOUT_MS / 1000}s`));
          }
        }, TIMEOUT_MS);

        const settle = () => {
          if (settleTimer) clearTimeout(settleTimer);
          settleTimer = setTimeout(() => {
            if (result) {
              clearTimeout(timeoutId);
              unsubscribe();
              console.error(`[berean] Response settled (no new events for 5s)`);
              resolve(result);
            }
          }, 5_000);
        };

        const unsubscribe = session.on((event: Record<string, unknown>) => {
          const eventType = event.type as string;
          console.error(`[berean] Event: ${eventType}`);

          if (eventType === 'assistant.message') {
            const data = event.data as Record<string, unknown>;
            result = (data?.content as string) || result;
            gotMessage = true;
            settle();
          } else if (eventType === 'session.idle') {
            if (settleTimer) clearTimeout(settleTimer);
            clearTimeout(timeoutId);
            unsubscribe();
            console.error(`[berean] session.idle received`);
            resolve(result);
          } else if (eventType === 'session.error') {
            if (settleTimer) clearTimeout(settleTimer);
            clearTimeout(timeoutId);
            unsubscribe();
            const data = event.data as Record<string, string>;
            reject(new Error(data?.message || 'Session error'));
          } else {
            if (gotMessage) settle();
          }
        });

        console.error(`[berean] Sending prompt (${user.length} chars)...`);
        session.send({ prompt: user }).catch((e: Error) => {
          if (settleTimer) clearTimeout(settleTimer);
          clearTimeout(timeoutId);
          unsubscribe();
          reject(e);
        });
      });
    } else {
      // SDK doesn't work — use direct HTTP API
      const token = getGitHubTokenFromAzure();
      if (!token) {
        return { success: false, error: 'No GitHub token available for HTTP fallback', model };
      }
      console.error(`[berean] Using direct HTTP API for review...`);
      content = await chatCompletion(token, model, system, user, TIMEOUT_MS);
    }

    if (!content) {
      // SDK returned empty — try direct HTTP as fallback
      const token = getGitHubTokenFromAzure();
      if (token) {
        console.error(`[berean] SDK returned empty, trying direct HTTP API...`);
        content = await chatCompletion(token, model, system, user, TIMEOUT_MS);
      }
    }

    if (!content) {
      return {
        success: false,
        error: 'Empty response from API',
        model
      };
    }

    // Parse the JSON response
    const result = parseReviewResponse(content, model);
    if (result.issues && confidenceThreshold) {
      result.issues = result.issues.filter(i => (i.confidence || 100) >= confidenceThreshold);
    }
    return result;

  } catch (error) {
    // If SDK fails completely, try direct HTTP fallback
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    const token = getGitHubTokenFromAzure();
    
    if (token && (errMsg.includes('Timeout') || errMsg.includes('No response') || errMsg.includes('session.idle'))) {
      console.error(`[berean] SDK failed (${errMsg}), falling back to direct HTTP API...`);
      try {
        const { system: systemFallback, user: userFallback } = buildReviewPrompt(language, diff, rules);
        const content = await chatCompletion(token, model, systemFallback, userFallback, 300_000);
        
        if (content) {
          const result = parseReviewResponse(content, model);
          if (result.issues && confidenceThreshold) {
            result.issues = result.issues.filter(i => (i.confidence || 100) >= confidenceThreshold);
          }
          return result;
        }
      } catch (httpError) {
        console.error(`[berean] HTTP fallback also failed: ${httpError instanceof Error ? httpError.message : httpError}`);
      }
    }
    
    return {
      success: false,
      error: errMsg,
      model
    };
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
      recommendation?: ReviewResult['recommendation'];
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
        recommendation: parsed.recommendation,
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

function buildReviewPrompt(language: string, diff: string, rules?: string): { system: string; user: string } {
  let system = `You are an expert code reviewer with deep expertise in software engineering best practices, security vulnerabilities, performance optimization, and code quality. Your role is advisory — provide clear, actionable feedback on code quality and potential issues.

You MUST respond with ONLY a valid JSON object (no markdown, no code blocks, no extra text). The JSON must follow this exact schema:

{
  "summary": "2-3 sentences describing what the changes do and overall assessment",
  "recommendation": "APPROVE | APPROVE_WITH_SUGGESTIONS | NEEDS_CHANGES | NEEDS_DISCUSSION",
  "issues": [
    {
      "severity": "critical | warning | suggestion",
      "category": "security | bug | performance | error-handling | maintainability | data-integrity | concurrency | resource-leak",
      "confidence": 85,
      "file": "/path/to/file.ts",
      "line": 42,
      "title": "Brief one-line title of the issue",
      "message": "Detailed description of the issue, why it matters, and how to fix it",
      "suggestion": "Optional: corrected code snippet"
    }
  ],
  "positives": ["List of good practices observed in the code"],
  "recommendations": ["General recommendations for improvement"]
}

CONFIDENCE THRESHOLDS — Only report issues where you have high confidence:
- CRITICAL (95%+): Security vulnerabilities, data loss risks, crashes, authentication bypasses
- WARNING (85%+): Bugs, logic errors, performance issues, unhandled errors
- SUGGESTION (75%+): Code quality improvements, best practices, maintainability
- Below 75%: Do NOT report — insufficient confidence

CATEGORIES:
- security: Injection, auth issues, data exposure, insecure defaults
- bug: Logic errors, null/undefined handling, race conditions, incorrect behavior
- performance: Inefficient algorithms, memory leaks, unnecessary computations
- error-handling: Missing try-catch, unhandled promises, silent failures
- maintainability: Code complexity, duplication, poor abstractions
- data-integrity: Data validation, type coercion issues, boundary conditions
- concurrency: Race conditions, deadlocks, thread safety
- resource-leak: Unclosed connections, file handles, event listeners

DO NOT REPORT:
- Style preferences that don't affect functionality
- Minor naming suggestions unless severely misleading
- Import ordering or grouping preferences
- Whitespace or formatting issues
- Patterns that are conventional in the language/framework being used
- Minor refactoring that doesn't improve readability or performance meaningfully
- Personal coding preferences

RECOMMENDATION CRITERIA:
- APPROVE: No issues found, or only minor suggestions with confidence < 80
- APPROVE_WITH_SUGGESTIONS: Only suggestions (no warnings/critical), code is safe to merge
- NEEDS_CHANGES: Has warnings or critical issues that should be fixed before merge
- NEEDS_DISCUSSION: Has architectural concerns or trade-offs that need team discussion

CRITICAL RULES:
1. Response must be ONLY the JSON object — no markdown, no \`\`\`json blocks, just raw JSON
2. "file" must be the EXACT file path as shown in the diff headers
3. "line" must be a line number from the NEW version of the file (lines with + prefix)
4. "issues" array can be empty [] if there are no problems above confidence threshold
5. All text content must be in ${language}
6. Be specific and actionable — vague suggestions are worse than no suggestions
7. Each issue MUST have a "title" field with a brief one-line description`;

  if (rules) {
    system += `\n\n---\n\nPROJECT-SPECIFIC RULES AND GUIDELINES (use these to evaluate the code, they take priority over general rules):\n\n${rules}`;
  }

  const user = `Here is the code diff to review:\n\n${diff}`;

  return { system, user };
}

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
export async function fetchModels(): Promise<ModelDetail[]> {
  try {
    const client = await getClient();
    await client.start();
    const models = await client.listModels();

    return models.map((m) => {
      // The SDK types are narrower than the actual API response
      // Use type assertion to access extended fields
      const caps = m.capabilities as unknown as Record<string, unknown>;
      const limits = (caps?.limits ?? {}) as Record<string, unknown>;
      const supports = (caps?.supports ?? {}) as Record<string, unknown>;
      const billing = (m.billing ?? {}) as unknown as Record<string, unknown>;

      return {
        id: m.id,
        name: m.name,
        isDefault: m.id === 'gpt-4o',
        isPremium: (billing.is_premium as boolean) ?? false,
        multiplier: m.billing?.multiplier ?? 0,
        maxContextTokens: limits.max_context_window_tokens as number | undefined,
        maxOutputTokens: limits.max_output_tokens as number | undefined,
        supportsVision: m.capabilities?.supports?.vision ?? false,
        supportsToolCalls: (supports.tool_calls as boolean) ?? false,
        supportsStreaming: (supports.streaming as boolean) ?? false,
        supportsReasoning: m.capabilities?.supports?.reasoningEffort ?? false,
        reasoningEfforts: m.supportedReasoningEfforts as string[] | undefined,
        defaultReasoningEffort: m.defaultReasoningEffort as string | undefined,
        policyState: m.policy?.state,
      };
    });
  } catch {
    // Fallback: return known models when API is unavailable
    // (e.g., classic PAT tokens don't support models.list)
    return FALLBACK_MODELS;
  }
}

const FALLBACK_MODELS: ModelDetail[] = [
  { id: 'gpt-4o', name: 'GPT-4o', isDefault: true },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', isDefault: false },
  { id: 'gpt-4.1', name: 'GPT-4.1', isDefault: false },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', isDefault: false },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', isDefault: false },
  { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', isDefault: false },
  { id: 'claude-haiku-4.5', name: 'Claude Haiku 4.5', isDefault: false },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview)', isDefault: false },
  { id: 'o3-mini', name: 'o3-mini', isDefault: false },
];
