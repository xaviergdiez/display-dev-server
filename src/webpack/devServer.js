const path = require('path');
const fs = require('fs-extra');
const webpack = require('webpack');
const webpackHotMiddleware = require('webpack-hot-middleware');
const webpackDevMiddleware = require('webpack-dev-middleware');
const express = require('express');
// const handlebars = require('handlebars');
const portfinder = require('portfinder');
const util = require('util');
const chalk = require('chalk');
const open = require('open');
const cliProgress = require("cli-progress");

const extendObject = require('../util/extendObject');
const createObjectFromJSONPath = require('../util/createObjectFromJSONPath');
const getDataFromGoogleSpreadsheet = require('../util/getDataFromGoogleSpreadsheet');
const removeTempRichmediaRcSync = require('../util/removeTempRichmediaRcSync');

const getNameFromLocation = require('../util/getNameFromLocation');

/**
 *
 * @param {Array<{webpack: *, settings: {location, data}}>} configs
 * @param {boolean} openLocation
 */
module.exports = async function devServer(configs, openLocation = true) {
  const start = Date.now()

  const webpackConfigList = configs.map(({ webpack }) => webpack);
  const settingsList = configs.map(({ settings }) => settings);
  const port = await portfinder.getPortPromise();
  
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(configs.length, 0);

  const httpLocation = `http://localhost:${port}`;

  console.log(`
${chalk.blue('i')} ${openLocation
  ? `Server ${httpLocation} is running and will open automatically. It might take a while to load.`
  : `Server ${httpLocation} is running. It might take a while to load.`
}
${chalk.grey.bold('-------------------------------------------------------')}
  `);

  const app = express();

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

    progressBar.increment()
  }

  progressBar.stop();

  app.use('/', express.static(path.join(__dirname, '../preview/dist')));

  openLocation && open(`${httpLocation}?gsdevtools=true`);

  const client = configs[0].settings.data.settings.client
  if (client) {
    app.get(`/client.${client.split('.').at(-1)}`, (req, res) => {
      res.sendFile(configs[0].settings.data.settings.client)
    })
  }

  app.get('/data/ads.json', (req, res) => {
    res.json({
      isGoogleSpreadsheetBanner: typeof configs[0].settings.data.settings.contentSource !== 'undefined',
      client: client ? `client.${client.split('.').at(-1)}` : undefined,
      ads: settingsList.map(e => {
        const assetName = getNameFromLocation(e.location)
        const bundleName = e.data.settings.bundleName || getNameFromLocation(e.location)
        const url = `${httpLocation}/${assetName}/index.html`
        return {
          url,
          ...e.data.settings.size,
          bundleName,
          output: {
            html: {
              url,
            },
          },
          info: e.data.settings.info,
          controlsOff: e.data.settings.controlsOff,
        }
      })
    })
  })

  app.get("/reload_dynamic_data", async function (req, res) {
    const cacheSpreadSheets = {};

    // fetch and pre-process
    await Promise.all(
      configs
      .map(config => config.settings?.data?.settings?.contentSource)
      .filter(contentSource => contentSource !== undefined)
      .map(({ url, tabName, apiKey }) => JSON.stringify({ url, tabName, apiKey }))
      .filter((x, i, a) => a.indexOf(x) == i) // unique
      .map(JSON.parse)
      .map(async contentSource => {
        const spreadsheetData = await getDataFromGoogleSpreadsheet(contentSource)
  
        const staticRowObjects = spreadsheetData.rows.map(row => {
          const staticRow = spreadsheetData.headerValues.reduce((prev, name) => {
            prev[name] = row[name];
            return prev;
          }, {});
  
          let staticRowObject = {};
          for (const key in staticRow) {
            if (staticRow.hasOwnProperty(key)) {
              let obj = createObjectFromJSONPath(key, staticRow[key]);
              extendObject(staticRowObject, obj);
            }
          }
  
          return staticRowObject
        })
  
        cacheSpreadSheets[JSON.stringify({ url, tabName, apiKey } = contentSource)] = {
          spreadsheetData,
          staticRowObjects
        }
      })
    )

    await Promise.all(configs.map(async config => {
      const { data } = config.settings;

      const contentSource = data.settings.contentSource;

      const { url, tabName, apiKey } = contentSource
      const { staticRowObjects } = cacheSpreadSheets[JSON.stringify({ url, tabName, apiKey })]

      const index = config.settings.row.rowNumber - 2 //for example, row number 2 is array element 0

      const staticRowObject = staticRowObjects[index]

      // new content object with updated content from sheet
      let content = extendObject({}, (config.settings.data.content || {}), staticRowObject)

      // next 4 lines is reading existing richmediarc from the disk, updating the content object, and then writing the new file to disk again
      const configFile = await fs.readFile(config.settings.location, {encoding:'utf8', flag:'r'})
      const configFileJson = JSON.parse(configFile);
      content = JSON.parse(JSON.stringify(content))

      if (!util.isDeepStrictEqual(configFileJson.content, content)) { //compare 'new' content with old content. If anything has changed, write a new file
        configFileJson.content = content;
        await fs.writeFile(config.settings.location, Buffer.from(JSON.stringify(configFileJson)));
      }
    }))

    res.send('ok');
  });

  console.log(chalk.green(`Built all banners for dev in ${Date.now() - start}ms`));

  // eslint-disable-next-line
  process.stdin.resume();//so the program will not close instantly

  function exitHandler(options, exitCode) {
    if (options.cleanup) removeTempRichmediaRcSync(configs);
    if (exitCode || exitCode === 0) console.log(exitCode);
    if (options.exit) process.exit();
  }

  //do something when app is closing
  process.on('exit', exitHandler.bind(null,{cleanup:true}));

  //catches ctrl+c event
  process.on('SIGINT', exitHandler.bind(null, {exit:true}));

  // catches "kill pid" (for example: nodemon restart)
  process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
  process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

  //catches uncaught exceptions
  process.on('uncaughtException', exitHandler.bind(null, {exit:true}));

  app.listen(port, () => {});
};
