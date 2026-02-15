const path = require("path");
const removeTempRichmediaRc = require("../util/removeTempRichmediaRc");
const cliProgress = require("cli-progress");
const chalk = require("chalk");
const workerFarm = require('worker-farm');

module.exports = async function buildFiles(result, options) {
  const start = Date.now();

  const webpackRun = workerFarm(
    {
      autoStart: true,
      maxRetries: 0,
      maxConcurrentCallsPerWorker: 1,
      maxConcurrentWorkers: options.parallel === true ? 4 : options.parallel
    },
    require.resolve('./webpackRun')
  );
  
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(result.length, 0);

  const qualities = await Promise.all(result.map((result) => {
    delete result.settings.row
    return new Promise(res => webpackRun({ config: result.settings, options }, (quality) => {
      progressBar.increment()
      res(quality)
    }));
  }));

  await new Promise(res => workerFarm.end(webpackRun, res))

  progressBar.stop();
  console.log(chalk.green(`Built in ${Date.now() - start}ms`));

  // final clean up
  console.log("Removing temp .richmediarc...");
  await removeTempRichmediaRc(result);

  return {
    outputDir: path.resolve(options.outputDir),
    ads: qualities,
  };
};
