#!/usr/bin/env node

import { Command } from 'commander';
import { authCommand } from './commands/auth.js';
import { reviewCommand } from './commands/review.js';
import { configCommand } from './commands/config.js';
import { updateCommand } from './commands/update.js';
import { modelsCommand } from './commands/models.js';

const program = new Command();

program
  .name('berean')
  .description('🔍 AI-powered code review for Azure DevOps PRs using GitHub Copilot')
  .version('0.1.0-beta', '-v, --version', 'Show current version');

program.addCommand(authCommand);
program.addCommand(reviewCommand);
program.addCommand(configCommand);
program.addCommand(updateCommand);
program.addCommand(modelsCommand);

program.parse();
