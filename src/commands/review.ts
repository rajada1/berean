import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { parsePRUrl, fetchPRDiff } from '../services/azure-devops.js';
import { reviewCode, fetchModels } from '../providers/github-copilot.js';
import { isAuthenticated } from '../services/copilot-auth.js';
import { getAzureDevOpsPAT } from '../services/credentials.js';

export const reviewCommand = new Command('review')
  .description('Review a Pull Request')
  .argument('[url]', 'Azure DevOps PR URL')
  .option('--org <organization>', 'Azure DevOps organization')
  .option('--project <project>', 'Azure DevOps project')
  .option('--repo <repository>', 'Repository name')
  .option('--pr <id>', 'Pull Request ID')
  .option('--model <model>', 'AI model to use (default: gpt-4o)')
  .option('--language <lang>', 'Response language (default: English)')
  .option('--json', 'Output as JSON')
  .option('--list-models', 'List available models')
  .action(async (url, options) => {
    // List models
    if (options.listModels) {
      await listModels();
      return;
    }

    // Check authentication
    if (!isAuthenticated()) {
      console.log(chalk.red('✗ Not authenticated. Run: berean auth login'));
      process.exit(1);
    }

    // Check Azure DevOps PAT
    if (!getAzureDevOpsPAT()) {
      console.log(chalk.red('✗ Azure DevOps PAT not configured.'));
      console.log(chalk.gray('  Set AZURE_DEVOPS_PAT environment variable or run:'));
      console.log(chalk.gray('  berean config set azure-pat <your-pat>'));
      process.exit(1);
    }

    // Parse PR info
    let prInfo;
    
    if (url) {
      prInfo = parsePRUrl(url);
      if (!prInfo) {
        console.log(chalk.red('✗ Invalid Azure DevOps PR URL'));
        console.log(chalk.gray('  Expected format: https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}'));
        process.exit(1);
      }
    } else if (options.org && options.project && options.repo && options.pr) {
      prInfo = {
        organization: options.org,
        project: options.project,
        repository: options.repo,
        pullRequestId: parseInt(options.pr, 10)
      };
    } else {
      console.log(chalk.red('✗ Please provide a PR URL or use --org, --project, --repo, --pr flags'));
      process.exit(1);
    }

    // Fetch PR diff
    const diffSpinner = ora('Fetching PR diff...').start();
    
    const diffResult = await fetchPRDiff(prInfo);
    
    if (!diffResult.success || !diffResult.diff) {
      diffSpinner.fail('Failed to fetch PR diff');
      console.log(chalk.red(`  ${diffResult.error}`));
      process.exit(1);
    }

    diffSpinner.succeed(`Fetched PR: ${diffResult.prDetails?.title || 'Unknown'}`);

    // Review code
    const reviewSpinner = ora(`Reviewing with ${options.model || 'gpt-4o'}...`).start();

    const reviewResult = await reviewCode(diffResult.diff, {
      model: options.model,
      language: options.language
    });

    if (!reviewResult.success) {
      reviewSpinner.fail('Review failed');
      console.log(chalk.red(`  ${reviewResult.error}`));
      process.exit(1);
    }

    reviewSpinner.succeed('Review complete!');

    // Output result
    if (options.json) {
      console.log(JSON.stringify(reviewResult, null, 2));
    } else {
      console.log('\n' + chalk.blue.bold('═'.repeat(60)));
      console.log(chalk.blue.bold(' Code Review Results'));
      console.log(chalk.blue.bold('═'.repeat(60)) + '\n');

      if (reviewResult.summary) {
        console.log(chalk.white.bold('Summary:'));
        console.log(chalk.white(reviewResult.summary) + '\n');
      }

      if (reviewResult.issues && reviewResult.issues.length > 0) {
        console.log(chalk.white.bold('Issues Found:\n'));
        
        for (const issue of reviewResult.issues) {
          let icon, color;
          switch (issue.severity) {
            case 'critical':
              icon = '🔴';
              color = chalk.red;
              break;
            case 'warning':
              icon = '🟡';
              color = chalk.yellow;
              break;
            default:
              icon = '🔵';
              color = chalk.blue;
          }

          console.log(`${icon} ${color.bold(issue.severity.toUpperCase())}`);
          if (issue.file) {
            console.log(chalk.gray(`   ${issue.file}${issue.line ? `:${issue.line}` : ''}`));
          }
          console.log(chalk.white(`   ${issue.message}\n`));
        }
      } else if (reviewResult.review) {
        // Raw review output
        console.log(reviewResult.review);
      } else {
        console.log(chalk.green('✓ No issues found! Code looks good.'));
      }

      console.log(chalk.blue.bold('═'.repeat(60)));
    }
  });

async function listModels() {
  if (!isAuthenticated()) {
    console.log(chalk.red('✗ Not authenticated. Run: berean auth login'));
    process.exit(1);
  }

  const spinner = ora('Fetching available models...').start();

  try {
    const models = await fetchModels();
    spinner.succeed('Available models:\n');

    for (const model of models) {
      const defaultBadge = model.isDefault ? chalk.green(' (default)') : '';
      console.log(`  ${chalk.cyan(model.id)}${defaultBadge}`);
      if (model.name !== model.id) {
        console.log(chalk.gray(`    ${model.name}`));
      }
    }
  } catch (error) {
    spinner.fail('Failed to fetch models');
    console.log(chalk.red(`  ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}
