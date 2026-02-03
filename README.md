# Berean 🔍

AI-powered code review CLI for Azure DevOps Pull Requests using GitHub Copilot.

*Like the Bereans who examined everything carefully (Acts 17:11), this tool examines your code with diligence.*

## Features

- 🔐 GitHub Copilot authentication (uses your existing subscription)
- 🔍 Automatic PR diff extraction from Azure DevOps
- 🤖 AI-powered code review with multiple models (GPT-4o, Claude, Gemini)
- 📊 Structured output with severity levels
- 🔄 CI/CD ready with environment variables

## Installation

```bash
npm install -g berean
```

## Quick Start

```bash
# 1. Authenticate with GitHub Copilot
berean auth login

# 2. Configure Azure DevOps PAT
berean config set azure-pat <your-pat>

# 3. Review a PR
berean review https://dev.azure.com/org/project/_git/repo/pullrequest/123
```

## Authentication

### Interactive Login (local development)

```bash
berean auth login
```

This will:
1. Display a URL and code
2. You open the URL and enter the code
3. Authorize the app on GitHub
4. Token is saved to `~/.berean/credentials.json`

### CI/CD (environment variables)

```bash
export GITHUB_OAUTH_TOKEN="gho_xxxxx"
export AZURE_DEVOPS_PAT="xxxxx"

berean review https://dev.azure.com/org/project/_git/repo/pullrequest/123
```

## Commands

### `berean auth`

```bash
berean auth login    # Authenticate with GitHub Copilot
berean auth logout   # Sign out
berean auth status   # Check authentication status
```

### `berean review`

```bash
# Review by URL
berean review https://dev.azure.com/org/project/_git/repo/pullrequest/123

# Review with flags
berean review --org myorg --project myproj --repo myrepo --pr 123

# Use specific model
berean review <url> --model claude-sonnet-4

# Output as JSON
berean review <url> --json

# List available models
berean review --list-models
```

### `berean config`

```bash
berean config set azure-pat <token>    # Set Azure DevOps PAT
berean config set default-model <model> # Set default AI model
berean config set language <lang>       # Set response language
berean config get                       # Show all config
berean config path                      # Show config directory
```

## CI/CD Integration

### Azure Pipelines

```yaml
trigger:
  - none

pr:
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
      berean review --pr $(System.PullRequest.PullRequestId) \
        --org $(System.TeamFoundationCollectionUri) \
        --project $(System.TeamProject) \
        --repo $(Build.Repository.Name) \
        --json > review.json
    displayName: 'Run AI Review'
    env:
      GITHUB_OAUTH_TOKEN: $(GithubOAuthToken)
      AZURE_DEVOPS_PAT: $(System.AccessToken)

  - script: |
      cat review.json
    displayName: 'Show Review Results'
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

      - run: berean review "${{ inputs.pr_url }}" --json
        env:
          GITHUB_OAUTH_TOKEN: ${{ secrets.GITHUB_OAUTH_TOKEN }}
          AZURE_DEVOPS_PAT: ${{ secrets.AZURE_DEVOPS_PAT }}
```

## Available Models

With GitHub Copilot subscription, you have access to:

- `gpt-4o` (default) - Most capable
- `gpt-4o-mini` - Fast and efficient
- `claude-sonnet-4` - Anthropic Claude
- `claude-3.5-sonnet` - Anthropic Claude
- `gemini-2.0-flash` - Google Gemini
- `o3-mini` - Fast reasoning

List all available models:

```bash
berean review --list-models
```

## Config Files

Berean stores configuration in `~/.berean/`:

```
~/.berean/
├── config.json       # Settings (model, language)
└── credentials.json  # Tokens (chmod 600)
```

## License

MIT
