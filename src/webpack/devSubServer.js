const webpack = require('webpack');
const webpackHotMiddleware = require('webpack-hot-middleware');
const webpackDevMiddleware = require('webpack-dev-middleware');
const express = require('express');

const createConfigByRichmediarcList = require('./config/createConfigByRichmediarcList')

const getNameFromLocation = require('../util/getNameFromLocation');

/**
 *
 * @param {Array<{settings: {location, data}}>} configs
 * @param {{}} options
 * @param {number} port
 */
module.exports = async function devSubServer({configs, options, port}, cb) {
  const webpackConfigList = await createConfigByRichmediarcList(configs, options);
  const settingsList = configs;

  const app = express();

  // for loop to make webpacks run 1 at a time, we're anyway in parallel
  for (let index = 0; index < webpackConfigList.length; index++) {
    const config = webpackConfigList[index]

    const hmrPath = '__webpack_hmr';
    const name = getNameFromLocation(settingsList[index].location);

    config.mode = 'development';

    config.output = {
      ...config.output,
      hotUpdateChunkFilename: '.hot/.hot-update.js',
      hotUpdateMainFilename: '.hot/.hot-update.json',
    };

    await new Promise(res => {
      const compiler = webpack(config, res);

      app.use(
        webpackDevMiddleware(compiler, {
          publicPath: `/${name}/`,
        }),
      );

      app.use(
        webpackHotMiddleware(compiler, {
          path: `/${name}/${hmrPath}`,
        }),
      );
    })

    process.send('increment')
  }

  app.listen(port, () => {});
  cb();
};
