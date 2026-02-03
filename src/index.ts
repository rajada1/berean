#!/usr/bin/env node

import { Command } from 'commander';
import { authCommand } from './commands/auth.js';
import { reviewCommand } from './commands/review.js';
import { configCommand } from './commands/config.js';

const program = new Command();

program
  .name('berean')
  .description('🔍 AI-powered code review for Azure DevOps PRs using GitHub Copilot')
  .version('1.0.0');

program.addCommand(authCommand);
program.addCommand(reviewCommand);
program.addCommand(configCommand);

program.parse();
