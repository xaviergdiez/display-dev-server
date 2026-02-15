#! /usr/bin/env node

const displayDevServer = require('../src/index');
// const jsonParseDeep = require('./src/util/jsonParseDeep');
const program = require('commander');
const chalk = require('chalk');
const packageJson = require('../package.json');
const base64 = require("../src/util/base64");

console.log(`Welcome to the ${chalk.green.bold(`x-code.studio Display Dev Server`)} v${packageJson.version}`);

program
  .version(packageJson.version)
  .option('-g, --glob <data>', 'Globbing pattern like "-p ./src/**/.richmediarc"', "./**/.richmediarc*")
  .option('-ss, --stats', 'Show stats when building')
  .option('-c, --choices <data>', 'predetermined settings')
  .option('-m, --mode <data>', 'development or production', 'development')
  .option('-o, --outputDir <data>', 'output dir', './build')
  .option('--skipBuild', 'skip compiling ads phase', false)
  .option('--skipPreview', 'skip preview building phase', false)
  .option('-p, --parallel [data]', 'run webpack in parallel')
  .parse(process.argv);

const options = program.opts();

(async () => {

  await displayDevServer({
    ...options,
    choices: options.choices ? JSON.parse(base64.decode(options.choices)) : null,
  })

  console.log(`${chalk.green('✔')} done`);

})();


