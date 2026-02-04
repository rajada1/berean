import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'readline';
import { 
  startDeviceFlow, 
  pollForOAuthToken, 
  getAuthStatus,
  isAuthenticated
} from '../services/copilot-auth.js';
import { clearCredentials, getConfigDir, getConfig, saveConfig } from '../services/credentials.js';
import { fetchModels } from '../providers/github-copilot.js';

export const authCommand = new Command('auth')
  .description('Manage GitHub Copilot authentication');

authCommand
  .command('login')
  .description('Authenticate with GitHub Copilot')
  .action(async () => {
    if (isAuthenticated()) {
      const status = await getAuthStatus();
      if (status.hasSubscription) {
        console.log(chalk.yellow('⚠️  Already authenticated with GitHub Copilot.'));
        console.log(chalk.gray('Run "berean auth logout" first to re-authenticate.'));
        return;
      }
    }

    console.log(chalk.blue('🔐 Starting GitHub Copilot authentication...\n'));

    try {
      // Start device flow
      const deviceFlow = await startDeviceFlow();

      // Display instructions
      console.log(chalk.white('To authenticate, open this URL in your browser:\n'));
      console.log(chalk.cyan.bold(`  ${deviceFlow.verificationUri}\n`));
      console.log(chalk.white('And enter the code:\n'));
      console.log(chalk.green.bold(`  ${deviceFlow.userCode}\n`));
      console.log(chalk.gray(`Code expires in ${Math.floor(deviceFlow.expiresIn / 60)} minutes.\n`));

      // Poll for authorization
      const spinner = ora('Waiting for authorization...').start();

      await pollForOAuthToken(
        deviceFlow.deviceCode,
        deviceFlow.interval,
        Math.floor(deviceFlow.expiresIn / deviceFlow.interval),
        () => {
          spinner.text = 'Waiting for authorization...';
        }
      );

      spinner.succeed('Authorization received!');

      // Verify Copilot subscription
      const verifySpinner = ora('Verifying Copilot subscription...').start();
      
      const status = await getAuthStatus();
      
      if (status.hasSubscription) {
        verifySpinner.succeed('Copilot subscription verified!');
        console.log(chalk.green('\n✓ Authentication successful!'));
        console.log(chalk.gray(`  Credentials saved to ${getConfigDir()}/credentials.json`));

        // Prompt to select a model
        await promptModelSelection();
      } else {
        verifySpinner.fail('Copilot subscription not found');
        console.log(chalk.red('\n✗ No active GitHub Copilot subscription found.'));
        console.log(chalk.gray('  Make sure you have GitHub Copilot enabled on your account.'));
      }

    } catch (error) {
      console.log(chalk.red(`\n✗ Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

async function promptModelSelection() {
  console.log(chalk.blue('\n📋 Available AI Models:\n'));

  const spinner = ora('Fetching models...').start();
  
  try {
    const models = await fetchModels();
    spinner.stop();

    const config = getConfig();
    const currentModel = config['default_model'] || 'gpt-4o';

    models.forEach((model, index) => {
      const isDefault = model.id === currentModel;
      const marker = isDefault ? chalk.green(' (default)') : '';
      console.log(`  ${chalk.yellow(`${index + 1})`)} ${chalk.cyan(model.id)}${marker}`);
    });

    console.log();

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(chalk.white(`Select a default model (1-${models.length}) or press Enter to keep "${currentModel}": `), resolve);
    });

    rl.close();

    const selection = parseInt(answer, 10);

    if (!isNaN(selection) && selection >= 1 && selection <= models.length) {
      const selectedModel = models[selection - 1];
      config['default_model'] = selectedModel.id;
      saveConfig(config);
      console.log(chalk.green(`\n✓ Default model set to: ${chalk.cyan(selectedModel.id)}`));
    } else if (answer.trim() === '') {
      console.log(chalk.gray(`\n  Keeping default model: ${currentModel}`));
    } else {
      console.log(chalk.yellow(`\n  Invalid selection. Keeping default model: ${currentModel}`));
    }

    console.log(chalk.gray('\n  You can change this later with: berean models select'));

  } catch (error) {
    spinner.stop();
    console.log(chalk.yellow('\n  Could not fetch models. You can set a model later with: berean models select'));
  }
}

authCommand
  .command('logout')
  .description('Sign out from GitHub Copilot')
  .action(() => {
    clearCredentials();
    console.log(chalk.green('✓ Signed out successfully.'));
  });

authCommand
  .command('status')
  .description('Check authentication status')
  .action(async () => {
    console.log(chalk.blue('🔍 Checking authentication status...\n'));

    const status = await getAuthStatus();

    if (!status.authenticated) {
      console.log(chalk.yellow('○ Not authenticated'));
      console.log(chalk.gray('  Run "berean auth login" to authenticate.'));
      return;
    }

    if (status.hasSubscription) {
      console.log(chalk.green('● Authenticated with GitHub Copilot'));
      console.log(chalk.gray('  Ready to review PRs.'));
    } else {
      console.log(chalk.yellow('◐ Authenticated but no Copilot subscription'));
      if (status.error) {
        console.log(chalk.red(`  Error: ${status.error}`));
      }
      console.log(chalk.gray('  Make sure you have GitHub Copilot enabled.'));
    }
  });
