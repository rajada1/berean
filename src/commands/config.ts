import { Command } from 'commander';
import chalk from 'chalk';
import { saveConfig, getConfig, getConfigDir, getAzureDevOpsPAT, getGitHubToken, getDefaultModel, getDefaultLanguage } from '../services/credentials.js';

export const configCommand = new Command('config')
  .description('Manage configuration');

configCommand
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action((key: string, value: string) => {
    const validKeys = ['azure-pat', 'default-model', 'language'];
    
    if (!validKeys.includes(key)) {
      console.log(chalk.red(`✗ Unknown config key: ${key}`));
      console.log(chalk.gray(`  Valid keys: ${validKeys.join(', ')}`));
      process.exit(1);
    }

    switch (key) {
      case 'azure-pat':
        saveConfig({ azure_devops_pat: value });
        console.log(chalk.green('✓ Azure DevOps PAT saved.'));
        break;
      case 'default-model':
        saveConfig({ default_model: value });
        console.log(chalk.green(`✓ Default model set to: ${value}`));
        break;
      case 'language':
        saveConfig({ language: value });
        console.log(chalk.green(`✓ Language set to: ${value}`));
        break;
    }
  });

configCommand
  .command('get [key]')
  .description('Get configuration value(s)')
  .action((key?: string) => {
    const config = getConfig();

    if (key) {
      switch (key) {
        case 'azure-pat': {
          const pat = getAzureDevOpsPAT();
          if (pat) {
            const masked = pat.substring(0, 6) + '...' + pat.slice(-4);
            console.log(chalk.white(`azure-pat: ${masked}`));
          } else {
            console.log(chalk.gray('azure-pat: (not set)'));
          }
          break;
        }
        case 'default-model':
          console.log(chalk.white(`default-model: ${getDefaultModel()}`));
          if (process.env.BEREAN_MODEL) {
            console.log(chalk.gray('  (from BEREAN_MODEL env var)'));
          }
          break;
        case 'language':
          console.log(chalk.white(`language: ${getDefaultLanguage()}`));
          if (process.env.BEREAN_LANGUAGE) {
            console.log(chalk.gray('  (from BEREAN_LANGUAGE env var)'));
          }
          break;
        default:
          console.log(chalk.red(`✗ Unknown config key: ${key}`));
      }
    } else {
      // Show all config
      console.log(chalk.blue.bold('Configuration:\n'));
      
      console.log(chalk.white('  Config directory:'), chalk.gray(getConfigDir()));
      console.log();
      
      const hasPat = !!getAzureDevOpsPAT();
      const hasToken = !!getGitHubToken();
      
      console.log(chalk.white('  azure-pat:'), hasPat 
        ? chalk.green('configured') 
        : chalk.yellow('not set'));
      
      console.log(chalk.white('  github-auth:'), hasToken 
        ? chalk.green('via environment variable') 
        : chalk.yellow('using Copilot CLI'));
      
      console.log();
      console.log(chalk.white('  default-model:'), chalk.cyan(getDefaultModel()));
      if (process.env.BEREAN_MODEL) {
        console.log(chalk.gray('                  (from BEREAN_MODEL env var)'));
      }
      console.log(chalk.white('  language:'), chalk.cyan(getDefaultLanguage()));
      if (process.env.BEREAN_LANGUAGE) {
        console.log(chalk.gray('             (from BEREAN_LANGUAGE env var)'));
      }
    }
  });

configCommand
  .command('path')
  .description('Show config directory path')
  .action(() => {
    console.log(getConfigDir());
  });
