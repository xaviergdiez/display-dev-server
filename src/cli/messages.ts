// src/cli/messages.ts
// Replace any existing terminal output from the original MediaMonks toolchain with these

import chalk from 'chalk';

const BRAND = '@whoisxavier';
const VERSION = require('../../package.json').version;

export const messages = {

  welcome: () => {
    console.log('');
    console.log(chalk.blue('╔════════════════════════════════════════╗'));
    console.log(chalk.blue('║') + chalk.bold('   display-dev-server ' + VERSION.padEnd(20)) + chalk.blue('║'));
    console.log(chalk.blue('║') + chalk.gray('   ' + BRAND + ' display toolkit'.padEnd(37)) + chalk.blue('║'));
    console.log(chalk.blue('╚════════════════════════════════════════╝'));
    console.log('');
  },

  serverStarted: (port: number, units: string[]) => {
    console.log(chalk.green('✓ Server running at ') + chalk.bold(`http://localhost:${port}`));
    console.log(chalk.gray(`  Watching ${units.length} ad unit(s)`));
    console.log('');
  },

  unitFound: (name: string, size: string) => {
    console.log(chalk.blue('  ◆ ') + chalk.bold(name) + chalk.gray(` [${size}]`));
  },

  buildSuccess: (outputDir: string, count: number) => {
    console.log('');
    console.log(chalk.green(`✓ Build complete — ${count} unit(s) exported to `) + chalk.bold(outputDir));
    console.log('');
  },

  buildError: (err: Error) => {
    console.log('');
    console.log(chalk.red('✗ Build failed'));
    console.log(chalk.red('  ' + err.message));
    console.log('');
  },

  recordingStarted: (unit: string) => {
    console.log(chalk.yellow('⏺  Recording: ') + chalk.bold(unit));
  },

  recordingComplete: (outputPath: string) => {
    console.log(chalk.green('✓ Recording saved to ') + chalk.bold(outputPath));
  },

  generatorWelcome: () => {
    console.log('');
    console.log(chalk.blue.bold('  display-boilerplate generator'));
    console.log(chalk.gray('  ' + BRAND + ' · HTML5 ad scaffolding'));
    console.log('');
  },

  generatorComplete: (unitName: string) => {
    console.log('');
    console.log(chalk.green('✓ Created: ') + chalk.bold(unitName));
    console.log(chalk.gray('  Run ' + chalk.white('npm run dev') + ' to start the dev server'));
    console.log('');
  },

  lint: {
    pass: (file: string) => console.log(chalk.green('✓ ') + chalk.gray(file)),
    fail: (file: string, msg: string) => console.log(chalk.red('✗ ') + file + '\n  ' + chalk.red(msg)),
  },

};
