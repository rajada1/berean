import { CopilotClient } from '@github/copilot-sdk';
import { getGitHubTokenFromAzure } from '../services/credentials.js';
// Singleton client instance
let _client = null;
/**
 * Get or create a CopilotClient instance
 */
async function getClient() {
    if (_client)
        return _client;
    const token = getGitHubTokenFromAzure();
    const options = {};
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
export async function stopClient() {
    if (_client) {
        await _client.stop();
        _client = null;
    }
}
/**
 * Review code using GitHub Copilot SDK
 */
export async function reviewCode(diff, options = {}) {
    const { model = 'gpt-4o', language = 'English', rules } = options;
    try {
        const client = await getClient();
        const systemPrompt = buildReviewPrompt(language, rules);
        const session = await client.createSession({
            model,
            streaming: false,
        });
        // Send system prompt + diff as a review request
        const response = await session.sendAndWait({
            prompt: `${systemPrompt}\n\n---\n\nHere is the code diff to review:\n\n${diff}`,
        });
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
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            model
        };
    }
}
/**
 * Parse the AI response into structured review result
 */
function parseReviewResponse(content, model) {
    try {
        let jsonContent = content;
        // Extract JSON if wrapped in markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonContent = jsonMatch[1].trim();
        }
        let parsed = null;
        // First try parsing as-is
        try {
            parsed = JSON.parse(jsonContent);
        }
        catch {
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
            }
            catch {
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
    }
    catch {
        return {
            success: true,
            review: content,
            model
        };
    }
}
function buildReviewPrompt(language, rules) {
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
 * Fetch available models from Copilot SDK (real API call)
 * Falls back to a hardcoded list if the API call fails
 */
export async function fetchModels() {
    try {
        const client = await getClient();
        await client.start();
        const models = await client.listModels();
        return models.map((m) => {
            // The SDK types are narrower than the actual API response
            // Use type assertion to access extended fields
            const caps = m.capabilities;
            const limits = (caps?.limits ?? {});
            const supports = (caps?.supports ?? {});
            const billing = (m.billing ?? {});
            return {
                id: m.id,
                name: m.name,
                isDefault: m.id === 'gpt-4o',
                isPremium: billing.is_premium ?? false,
                multiplier: m.billing?.multiplier ?? 0,
                maxContextTokens: limits.max_context_window_tokens,
                maxOutputTokens: limits.max_output_tokens,
                supportsVision: m.capabilities?.supports?.vision ?? false,
                supportsToolCalls: supports.tool_calls ?? false,
                supportsStreaming: supports.streaming ?? false,
                supportsReasoning: m.capabilities?.supports?.reasoningEffort ?? false,
                reasoningEfforts: m.supportedReasoningEfforts,
                defaultReasoningEffort: m.defaultReasoningEffort,
                policyState: m.policy?.state,
            };
        });
    }
    catch {
        // Fallback: return known models when API is unavailable
        // (e.g., classic PAT tokens don't support models.list)
        return FALLBACK_MODELS;
    }
}
const FALLBACK_MODELS = [
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
//# sourceMappingURL=github-copilot.js.map