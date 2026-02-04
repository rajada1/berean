import { getValidCopilotCredentials } from '../services/copilot-auth.js';

export interface ReviewIssue {
  severity: 'critical' | 'warning' | 'suggestion';
  file?: string;
  line?: number;
  message: string;
  suggestion?: string; // Code suggestion for inline comments
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
}

/**
 * Review code using GitHub Copilot
 */
export async function reviewCode(
  diff: string, 
  options: ReviewOptions = {}
): Promise<ReviewResult> {
  const { model = 'gpt-4o', language = 'English', maxTokens = 16000 } = options;

  try {
    const credentials = await getValidCopilotCredentials();

    const systemPrompt = buildReviewPrompt(language);
    
    const response = await fetch(`${credentials.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Copilot-Integration-Id': 'vscode-chat',
        'Editor-Version': 'Berean/1.0.0',
        'X-GitHub-Api-Version': '2025-05-01'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: diff }
        ],
        temperature: 0.3,
        max_tokens: maxTokens,
        response_format: model.includes('gpt') ? { type: 'json_object' } : undefined
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: { error?: { message?: string }; message?: string } = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      throw new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    
    const content = data.choices?.[0]?.message?.content || '';
    
    if (!content) {
      return {
        success: false,
        error: 'Empty response from API',
        model
      };
    }

    // Try to parse as JSON
    try {
      // Try to extract JSON if wrapped in markdown code blocks
      let jsonContent = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim();
      }
      
      const parsed = JSON.parse(jsonContent) as {
        summary?: string;
        issues?: ReviewResult['issues'];
        positives?: string[];
        recommendations?: string[];
      };
      return {
        success: true,
        summary: parsed.summary,
        issues: parsed.issues,
        positives: parsed.positives,
        recommendations: parsed.recommendations,
        review: content,
        model
      };
    } catch {
      // Return raw content if not JSON
      return {
        success: true,
        review: content,
        model
      };
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      model
    };
  }
}

function buildReviewPrompt(language: string): string {
  return `You are an expert code reviewer. Analyze the provided code changes (git diff) and provide a comprehensive review.

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
}

/**
 * Fetch available models from Copilot
 */
export async function fetchModels(): Promise<Array<{
  id: string;
  name: string;
  isDefault: boolean;
}>> {
  const credentials = await getValidCopilotCredentials();

  const response = await fetch(`${credentials.endpoint}/models`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${credentials.token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Copilot-Integration-Id': 'vscode-chat',
      'Editor-Version': 'Berean/1.0.0',
      'X-GitHub-Api-Version': '2025-05-01'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status}`);
  }

  const data = await response.json() as {
    data?: Array<{
      id: string;
      name?: string;
      is_chat_default?: boolean;
      capabilities?: { type?: string };
      model_picker_enabled?: boolean;
    }>;
  };
  
  const models = data.data || [];

  return models
    .filter(m => m.capabilities?.type === 'chat' && m.model_picker_enabled !== false)
    .map(m => ({
      id: m.id,
      name: m.name || m.id,
      isDefault: m.is_chat_default || false
    }))
    .sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (b.isDefault && !a.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });
}
