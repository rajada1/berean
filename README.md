# Berean 🔍

AI-powered code review CLI for Azure DevOps Pull Requests using GitHub Copilot.

*Like the Bereans who examined everything carefully (Acts 17:11), this tool examines your code with diligence.*

## Features

- 🔐 **GitHub Copilot authentication** - Uses your existing subscription (no extra API keys)
- 🔍 **Automatic PR diff extraction** - Fetches changes directly from Azure DevOps
- 🤖 **AI-powered code review** - Multiple models (GPT-4o, Claude, Gemini)
- 📊 **Structured output** - Severity levels, suggestions, and recommendations
- 💬 **PR comments** - Post reviews directly to Azure DevOps PRs
- 📝 **Inline comments** - Comment on specific lines of code
- 🔄 **Anti-loop protection** - Prevents infinite review cycles in CI/CD
- 🌍 **Multi-language** - Responses in any language
- 🏭 **CI/CD ready** - Environment variables support

## Installation

```bash
npm install -g berean
```

## Quick Start

```bash
# 1. Authenticate with GitHub Copilot (will prompt to select a model)
berean auth login

# 2. Configure Azure DevOps PAT
berean config set azure-pat <your-pat>

# 3. Review a PR
berean review https://dev.azure.com/org/project/_git/repo/pullrequest/123
```

---

## Commands

### `berean auth`

Manage GitHub Copilot authentication.

```bash
berean auth login    # Authenticate with GitHub Copilot
berean auth logout   # Sign out and remove tokens
berean auth status   # Check authentication status
```

#### Interactive Login (local development)

```bash
berean auth login
```

This will:
1. Display a URL and a code
2. You open the URL in your browser and enter the code
3. Authorize the app on GitHub
4. Token is saved to `~/.berean/credentials.json` (chmod 600)
5. **List available AI models and prompt you to select a default**

#### CI/CD (environment variables)

For CI/CD, set environment variables instead:

```bash
export GITHUB_OAUTH_TOKEN="gho_xxxxx"
export AZURE_DEVOPS_PAT="xxxxx"
```

Priority: Environment variables → Config file → Error

---

### `berean models`

List and manage AI models.

```bash
berean models list      # List all available models
berean models select    # Interactively select a default model
berean models set <id>  # Set default model by ID
berean models current   # Show current default model
```

#### Examples

```bash
# List all available models
berean models list

# Interactively select a model (shows numbered list)
berean models select

# Set a specific model as default
berean models set claude-sonnet-4

# Check current default model
berean models current
```

#### Interactive Model Selection

When you run `berean models select`, you'll see:

```
📋 Available AI Models:

  1) gpt-4o (current)
  2) gpt-4o-mini
  3) claude-sonnet-4
  4) claude-3.5-sonnet
  5) gemini-2.0-flash
  6) o3-mini

Select a model (1-6) or press Enter to cancel:
```

---

### `berean review`

Review a Pull Request.

```bash
berean review <url> [options]
```

#### Basic Usage

```bash
# Review by URL
berean review https://dev.azure.com/org/project/_git/repo/pullrequest/123

# Review with explicit parameters
berean review --org myorg --project myproj --repo myrepo --pr 123
```

#### Options

| Option | Description |
|--------|-------------|
| `--org <organization>` | Azure DevOps organization |
| `--project <project>` | Azure DevOps project |
| `--repo <repository>` | Repository name |
| `--pr <id>` | Pull Request ID |
| `--model <model>` | AI model to use (default: gpt-4o) |
| `--language <lang>` | Response language (default: English) |
| `--json` | Output as JSON |
| `--list-models` | List available AI models |
| `--post-comment` | Post review as a comment on the PR |
| `--inline` | Post inline comments on specific lines |
| `--skip-if-reviewed` | Skip if PR was already reviewed by Berean |
| `--incremental` | Only review new commits since last Berean review |
| `--force` | Force review even if `@berean: ignore` is set |

#### Examples

```bash
# Use a specific AI model
berean review <url> --model claude-sonnet-4

# Review in Portuguese
berean review <url> --language "Português do Brasil"

# Output as JSON (for parsing in scripts)
berean review <url> --json

# List available models
berean review --list-models

# Post review as a comment on the PR
berean review <url> --post-comment

# Post inline comments on specific lines
berean review <url> --inline

# Both: general comment + inline comments
berean review <url> --post-comment --inline

# CI/CD: Skip if already reviewed
berean review <url> --post-comment --skip-if-reviewed

# CI/CD: Incremental review (update existing comment)
berean review <url> --post-comment --incremental
```

---

### `berean config`

Manage configuration settings.

```bash
berean config <command> [args]
```

#### Commands

| Command | Description |
|---------|-------------|
| `set <key> <value>` | Set a configuration value |
| `get [key]` | Get configuration value(s) |
| `path` | Show config directory path |

#### Configuration Keys

| Key | Description | Example |
|-----|-------------|---------|
| `azure-pat` | Azure DevOps Personal Access Token | `berean config set azure-pat xxxxx` |
| `default-model` | Default AI model for reviews | `berean config set default-model gpt-4o` |
| `language` | Default response language | `berean config set language "Português do Brasil"` |

#### Examples

```bash
# Set Azure DevOps PAT
berean config set azure-pat <your-token>

# Set default language to Portuguese
berean config set language "Português do Brasil"

# Set default model
berean config set default-model claude-sonnet-4

# Show all configuration
berean config get

# Show specific value
berean config get language

# Show config directory
berean config path
```

---

### `berean update`

Update Berean to the latest version.

```bash
berean update
```

---

## Anti-Loop Protection

Berean includes built-in protection to prevent infinite review cycles in CI/CD pipelines.

### Ignore Keyword

Add `@berean: ignore` anywhere in your PR description to skip the review:

```markdown
This PR refactors the payment module.

@berean: ignore
```

Variations accepted:
- `@berean: ignore`
- `@berean:ignore`
- `@berean ignore`
- `[berean:ignore]`
- `[berean: ignore]`

Use `--force` to override this and review anyway.

### Skip If Already Reviewed

Use `--skip-if-reviewed` to skip the review if Berean already posted a comment and there are no new commits:

```bash
berean review <url> --post-comment --skip-if-reviewed
```

This is ideal for CI/CD where the pipeline runs on every push.

### Incremental Reviews

Use `--incremental` to only review new commits since the last Berean review. The existing comment will be updated instead of creating a new one:

```bash
berean review <url> --post-comment --incremental
```

### Commit Tracking

When using `--post-comment`, Berean adds hidden HTML tags to track which commits were reviewed:

```html
<!-- berean-commits:abc123,def456:berean-commits -->
```

On the next run, Berean compares the current commits with the reviewed commits to determine if a new review is needed.

---

## CI/CD Integration

### Azure Pipelines

```yaml
trigger:
  - none

pr:
  branches:
    include:
      - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '18.x'

  - script: npm install -g berean
    displayName: 'Install Berean'

  - script: |
      PR_URL="https://dev.azure.com/$(System.CollectionUri)/$(System.TeamProject)/_git/$(Build.Repository.Name)/pullrequest/$(System.PullRequest.PullRequestId)"
      berean review "$PR_URL" --post-comment --inline --skip-if-reviewed
    displayName: 'Run AI Code Review'
    env:
      GITHUB_OAUTH_TOKEN: $(GithubOAuthToken)
      AZURE_DEVOPS_PAT: $(System.AccessToken)
```

### GitHub Actions (for Azure DevOps PRs)

```yaml
name: AI Code Review

on:
  workflow_dispatch:
    inputs:
      pr_url:
        description: 'Azure DevOps PR URL'
        required: true

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - run: npm install -g berean

      - name: Run AI Review
        run: berean review "${{ inputs.pr_url }}" --post-comment --inline
        env:
          GITHUB_OAUTH_TOKEN: ${{ secrets.GITHUB_OAUTH_TOKEN }}
          AZURE_DEVOPS_PAT: ${{ secrets.AZURE_DEVOPS_PAT }}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_OAUTH_TOKEN` | GitHub OAuth token for Copilot API |
| `AZURE_DEVOPS_PAT` | Azure DevOps Personal Access Token |

---

## Available Models

With a GitHub Copilot subscription, you have access to:

| Model | Description |
|-------|-------------|
| `gpt-4o` | Most capable (default) |
| `gpt-4o-mini` | Fast and efficient |
| `claude-sonnet-4` | Anthropic Claude Sonnet 4 |
| `claude-3.5-sonnet` | Anthropic Claude 3.5 Sonnet |
| `gemini-2.0-flash` | Google Gemini 2.0 Flash |
| `o3-mini` | OpenAI o3-mini (fast reasoning) |

List all available models:

```bash
berean review --list-models
```

---

## Review Output

Berean provides structured reviews with:

### Severity Levels

| Level | Icon | Description |
|-------|------|-------------|
| `critical` | 🔴 | Security vulnerabilities, bugs that will cause crashes, data loss |
| `warning` | 🟡 | Code smells, potential bugs, performance issues |
| `suggestion` | 🔵 | Style improvements, refactoring opportunities |

### Output Sections

- **Summary**: High-level overview of the changes
- **Issues**: Problems found with severity, file, line, and suggestions
- **Positives**: Good practices identified in the code
- **Recommendations**: General improvements for the codebase

### JSON Output

Use `--json` for machine-readable output:

```json
{
  "success": true,
  "summary": "Implementation of payment methods...",
  "issues": [
    {
      "severity": "critical",
      "file": "/src/payment.ts",
      "line": 42,
      "message": "SQL injection vulnerability",
      "suggestion": "Use parameterized queries"
    }
  ],
  "positives": ["Good use of TypeScript types"],
  "recommendations": ["Consider adding unit tests"]
}
```

---

## Config Files

Berean stores configuration in `~/.berean/`:

```
~/.berean/
├── config.json       # Settings (model, language)
└── credentials.json  # Tokens (chmod 600)
```

### config.json

```json
{
  "azure-pat": "xxxxx",
  "default-model": "gpt-4o",
  "language": "Português do Brasil"
}
```

### credentials.json

```json
{
  "oauth_token": "gho_xxxxx",
  "copilot_token": "tid=xxxxx;...",
  "expires_at": 1234567890
}
```

---

## Troubleshooting

### Authentication Issues

```bash
# Check auth status
berean auth status

# Re-authenticate
berean auth logout
berean auth login
```

### Azure DevOps PAT

Make sure your PAT has the following permissions:
- **Code**: Read
- **Pull Request Threads**: Read & Write (for posting comments)

### Token Expired

Berean automatically refreshes tokens. If you still have issues:

```bash
berean auth logout
berean auth login
```

---

## Contributing

Contributions are welcome! Please open an issue or PR on GitHub.

## License

MIT

---

*Generated with ❤️ by [Berean](https://github.com/rajada1/berean)*
