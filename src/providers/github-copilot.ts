import { getValidCopilotCredentials } from '../services/copilot-auth.js';

export interface ReviewResult {
  success: boolean;
  review?: string;
  summary?: string;
  issues?: Array<{
    severity: 'critical' | 'warning' | 'suggestion';
    file?: string;
    line?: number;
    message: string;
  }>;
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
      const parsed = JSON.parse(content) as {
        summary?: string;
        issues?: ReviewResult['issues'];
        review?: string;
      };
      return {
        success: true,
        summary: parsed.summary,
        issues: parsed.issues,
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

Respond in ${language} with a JSON object containing:

{
  "summary": "Brief summary of what the changes do (2-3 sentences)",
  "issues": [
    {
      "severity": "critical|warning|suggestion",
      "file": "path/to/file.ts",
      "line": 42,
      "message": "Description of the issue and how to fix it"
    }
  ],
  "positives": ["List of good practices observed"],
  "recommendations": ["General recommendations for improvement"]
}

Severity levels:
- critical: Security vulnerabilities, bugs that will cause crashes, data loss
- warning: Code smells, potential bugs, performance issues
- suggestion: Style improvements, refactoring opportunities

Be specific and actionable. Reference file paths and line numbers when possible.
Focus on meaningful issues, not trivial style preferences.
If the code is good, say so - don't invent problems.`;
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
