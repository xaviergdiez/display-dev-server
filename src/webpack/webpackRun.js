const webpack = require('webpack')
const chalk = require('chalk')

const createConfigByRichmediarcList = require('./config/createConfigByRichmediarcList')

module.exports = async function ({ config, options }, cb) {

  const webpackConfig = await createConfigByRichmediarcList([config], options);

  webpack(webpackConfig[0]).run((err, stats) => {
    if (err) {
      console.error(err.stack || err);
      if (err.details) {
        err.details.forEach((item, index) => {
          console.error(index, item.message);
        });
      }
      return;
    }

    const info = stats.toJson();

    if (stats.hasErrors()) {
      info.errors.forEach((item, index) => {
        console.log(chalk.red(item.message));
      });
    }

    // if (stats.hasWarnings()) {
    //   info.warnings.forEach((item) => {
    //     console.log(chalk.green(item.message));
    //   });
    // }

    cb(stats.compilation.quality);
  });
}
