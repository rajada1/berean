# Berean 🔍

> **🌍 Language / Idioma:** [English](README.md) | **Português**

CLI de code review com IA para Pull Requests do Azure DevOps usando GitHub Copilot.

*Assim como os Bereanos que examinavam tudo cuidadosamente (Atos 17:11), esta ferramenta examina seu código com diligência.*

## Funcionalidades

- 🔐 **Autenticação GitHub Copilot** - Usa sua assinatura existente (sem API keys extras)
- 🔍 **Extração automática de diff** - Busca alterações diretamente do Azure DevOps
- 🤖 **Code review com IA** - Múltiplos modelos (GPT-4o, Claude, Gemini)
- 📊 **Saída estruturada** - Níveis de severidade, sugestões e recomendações
- 💬 **Comentários no PR** - Posta reviews diretamente nos PRs do Azure DevOps
- 📝 **Comentários inline** - Comenta em linhas específicas do código
- 🔄 **Proteção anti-loop** - Previne ciclos infinitos de review em CI/CD
- 🌍 **Multi-idioma** - Respostas em qualquer idioma
- 🏭 **Pronto para CI/CD** - Suporte a variáveis de ambiente

## Instalação

```bash
npm install -g berean
```

## Início Rápido

```bash
# 1. Autenticar com GitHub Copilot (vai perguntar qual modelo usar)
berean auth login

# 2. Configurar PAT do Azure DevOps
berean config set azure-pat <seu-pat>

# 3. Revisar um PR
berean review https://dev.azure.com/org/project/_git/repo/pullrequest/123
```

---

## Comandos

### `berean auth`

Gerencia autenticação com GitHub Copilot.

```bash
berean auth login    # Autenticar com GitHub Copilot
berean auth logout   # Sair e remover tokens
berean auth status   # Verificar status da autenticação
```

#### Login Interativo (desenvolvimento local)

```bash
berean auth login
```

Isso vai:
1. Exibir uma URL e um código
2. Você abre a URL no navegador e digita o código
3. Autoriza o app no GitHub
4. Token é salvo em `~/.berean/credentials.json` (chmod 600)
5. **Lista modelos de IA disponíveis e pergunta qual usar como padrão**

#### CI/CD (variáveis de ambiente)

Para CI/CD, configure variáveis de ambiente:

```bash
export GITHUB_OAUTH_TOKEN="gho_xxxxx"
export AZURE_DEVOPS_PAT="xxxxx"
```

Prioridade: Variáveis de ambiente → Arquivo de config → Erro

---

### `berean models`

Lista e gerencia modelos de IA.

```bash
berean models list      # Lista todos os modelos disponíveis
berean models select    # Seleciona um modelo interativamente
berean models set <id>  # Define modelo padrão pelo ID
berean models current   # Mostra modelo padrão atual
```

#### Exemplos

```bash
# Listar todos os modelos disponíveis
berean models list

# Selecionar um modelo interativamente (mostra lista numerada)
berean models select

# Definir um modelo específico como padrão
berean models set claude-sonnet-4

# Ver modelo padrão atual
berean models current
```

#### Seleção Interativa de Modelo

Quando você roda `berean models select`, vai ver:

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

Revisa um Pull Request.

```bash
berean review <url> [opções]
```

#### Uso Básico

```bash
# Revisar por URL
berean review https://dev.azure.com/org/project/_git/repo/pullrequest/123

# Revisar com parâmetros explícitos
berean review --org myorg --project myproj --repo myrepo --pr 123
```

#### Opções

| Opção | Descrição |
|-------|-----------|
| `--org <organization>` | Organização do Azure DevOps |
| `--project <project>` | Projeto do Azure DevOps |
| `--repo <repository>` | Nome do repositório |
| `--pr <id>` | ID do Pull Request |
| `--model <model>` | Modelo de IA a usar (padrão: gpt-4o) |
| `--language <lang>` | Idioma das respostas (padrão: English) |
| `--json` | Saída em JSON |
| `--list-models` | Lista modelos de IA disponíveis |
| `--post-comment` | Posta review como comentário no PR |
| `--inline` | Posta comentários inline em linhas específicas |
| `--skip-if-reviewed` | Pula se o PR já foi revisado pelo Berean |
| `--incremental` | Revisa apenas novos commits desde a última review |
| `--force` | Força review mesmo se `@berean: ignore` estiver definido |

#### Exemplos

```bash
# Usar um modelo específico
berean review <url> --model claude-sonnet-4

# Revisar em Português
berean review <url> --language "Português do Brasil"

# Saída em JSON (para parsing em scripts)
berean review <url> --json

# Listar modelos disponíveis
berean review --list-models

# Postar review como comentário no PR
berean review <url> --post-comment

# Postar comentários inline em linhas específicas
berean review <url> --inline

# Ambos: comentário geral + comentários inline
berean review <url> --post-comment --inline

# CI/CD: Pular se já revisado
berean review <url> --post-comment --skip-if-reviewed

# CI/CD: Review incremental (atualiza comentário existente)
berean review <url> --post-comment --incremental
```

---

### `berean config`

Gerencia configurações.

```bash
berean config <comando> [args]
```

#### Comandos

| Comando | Descrição |
|---------|-----------|
| `set <key> <value>` | Define um valor de configuração |
| `get [key]` | Obtém valor(es) de configuração |
| `path` | Mostra caminho do diretório de config |

#### Chaves de Configuração

| Chave | Descrição | Exemplo |
|-------|-----------|---------|
| `azure-pat` | Personal Access Token do Azure DevOps | `berean config set azure-pat xxxxx` |
| `default-model` | Modelo de IA padrão para reviews | `berean config set default-model gpt-4o` |
| `language` | Idioma padrão das respostas | `berean config set language "Português do Brasil"` |

#### Exemplos

```bash
# Definir PAT do Azure DevOps
berean config set azure-pat <seu-token>

# Definir idioma padrão para Português
berean config set language "Português do Brasil"

# Definir modelo padrão
berean config set default-model claude-sonnet-4

# Mostrar todas as configurações
berean config get

# Mostrar valor específico
berean config get language

# Mostrar diretório de config
berean config path
```

---

### `berean update`

Atualiza o Berean para a versão mais recente.

```bash
berean update
```

---

## Proteção Anti-Loop

O Berean inclui proteção integrada para prevenir ciclos infinitos de review em pipelines CI/CD.

### Palavra-chave de Ignorar

Adicione `@berean: ignore` em qualquer lugar na descrição do PR para pular a review:

```markdown
Este PR refatora o módulo de pagamentos.

@berean: ignore
```

Variações aceitas:
- `@berean: ignore`
- `@berean:ignore`
- `@berean ignore`
- `[berean:ignore]`
- `[berean: ignore]`

Use `--force` para ignorar isso e revisar mesmo assim.

### Pular se Já Revisado

Use `--skip-if-reviewed` para pular a review se o Berean já postou um comentário e não há novos commits:

```bash
berean review <url> --post-comment --skip-if-reviewed
```

Ideal para CI/CD onde o pipeline roda em cada push.

### Reviews Incrementais

Use `--incremental` para revisar apenas novos commits desde a última review do Berean. O comentário existente será atualizado ao invés de criar um novo:

```bash
berean review <url> --post-comment --incremental
```

### Rastreamento de Commits

Ao usar `--post-comment`, o Berean adiciona tags HTML ocultas para rastrear quais commits foram revisados:

```html
<!-- berean-commits:abc123,def456:berean-commits -->
```

Na próxima execução, o Berean compara os commits atuais com os revisados para determinar se uma nova review é necessária.

---

## Integração CI/CD

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
    displayName: 'Instalar Berean'

  - script: |
      PR_URL="https://dev.azure.com/$(System.CollectionUri)/$(System.TeamProject)/_git/$(Build.Repository.Name)/pullrequest/$(System.PullRequest.PullRequestId)"
      berean review "$PR_URL" --post-comment --inline --skip-if-reviewed
    displayName: 'Executar AI Code Review'
    env:
      GITHUB_OAUTH_TOKEN: $(GithubOAuthToken)
      AZURE_DEVOPS_PAT: $(System.AccessToken)
```

### GitHub Actions (para PRs do Azure DevOps)

```yaml
name: AI Code Review

on:
  workflow_dispatch:
    inputs:
      pr_url:
        description: 'URL do PR no Azure DevOps'
        required: true

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - run: npm install -g berean

      - name: Executar AI Review
        run: berean review "${{ inputs.pr_url }}" --post-comment --inline
        env:
          GITHUB_OAUTH_TOKEN: ${{ secrets.GITHUB_OAUTH_TOKEN }}
          AZURE_DEVOPS_PAT: ${{ secrets.AZURE_DEVOPS_PAT }}
```

### Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `GITHUB_OAUTH_TOKEN` | Token OAuth do GitHub para API do Copilot |
| `AZURE_DEVOPS_PAT` | Personal Access Token do Azure DevOps |

---

## Modelos Disponíveis

Com uma assinatura do GitHub Copilot, você tem acesso a:

| Modelo | Descrição |
|--------|-----------|
| `gpt-4o` | Mais capaz (padrão) |
| `gpt-4o-mini` | Rápido e eficiente |
| `claude-sonnet-4` | Anthropic Claude Sonnet 4 |
| `claude-3.5-sonnet` | Anthropic Claude 3.5 Sonnet |
| `gemini-2.0-flash` | Google Gemini 2.0 Flash |
| `o3-mini` | OpenAI o3-mini (raciocínio rápido) |

Listar todos os modelos disponíveis:

```bash
berean review --list-models
```

---

## Saída da Review

O Berean fornece reviews estruturadas com:

### Níveis de Severidade

| Nível | Ícone | Descrição |
|-------|-------|-----------|
| `critical` | 🔴 | Vulnerabilidades de segurança, bugs que causam crashes, perda de dados |
| `warning` | 🟡 | Code smells, bugs potenciais, problemas de performance |
| `suggestion` | 🔵 | Melhorias de estilo, oportunidades de refatoração |

### Seções da Saída

- **Summary**: Visão geral das mudanças
- **Issues**: Problemas encontrados com severidade, arquivo, linha e sugestões
- **Positives**: Boas práticas identificadas no código
- **Recommendations**: Melhorias gerais para o codebase

### Saída JSON

Use `--json` para saída legível por máquina:

```json
{
  "success": true,
  "summary": "Implementação de métodos de pagamento...",
  "issues": [
    {
      "severity": "critical",
      "file": "/src/payment.ts",
      "line": 42,
      "message": "Vulnerabilidade de SQL injection",
      "suggestion": "Use consultas parametrizadas"
    }
  ],
  "positives": ["Bom uso de tipos TypeScript"],
  "recommendations": ["Considere adicionar testes unitários"]
}
```

---

## Arquivos de Configuração

O Berean armazena configurações em `~/.berean/`:

```
~/.berean/
├── config.json       # Configurações (modelo, idioma)
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

## Solução de Problemas

### Problemas de Autenticação

```bash
# Verificar status da autenticação
berean auth status

# Re-autenticar
berean auth logout
berean auth login
```

### PAT do Azure DevOps

Certifique-se que seu PAT tem as seguintes permissões:
- **Code**: Read
- **Pull Request Threads**: Read & Write (para postar comentários)

### Token Expirado

O Berean atualiza tokens automaticamente. Se ainda tiver problemas:

```bash
berean auth logout
berean auth login
```

---

## Contribuindo

Contribuições são bem-vindas! Por favor, abra uma issue ou PR no GitHub.

## Licença

MIT

---

*Gerado com ❤️ por [Berean](https://github.com/rajada1/berean)*
