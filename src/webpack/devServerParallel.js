const path = require('path');
const fs = require('fs-extra');
const express = require('express');
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

const workerFarm = require('worker-farm');

/**
 *
 * @param {Array<{webpack: *, settings: {location, data}}>} configs
 * @param {boolean} openLocation
 * @param {{}} options
 */
module.exports = async function devServer(configs, openLocation = true, options) {
  const start = Date.now()

  const N_SUBSERVERS = options.parallel === true ? 4 : options.parallel

  const settingsList = configs.map(({ settings }) => settings);
  const port = await portfinder.getPortPromise();
  
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(configs.length, 0);
  
  const devSubServer = workerFarm(
    {
      maxRetries: 0,
      autoStart: true,
      maxConcurrentCallsPerWorker: 1,
      maxConcurrentWorkers: N_SUBSERVERS,
      onChild: (subprocess) => {
        subprocess.on('message', (message) => {
          if (message == 'increment') {
            progressBar.increment()
          }
        })
      }
    },
    require.resolve('./devSubServer')
  );

  const httpLocation = `http://localhost:${port}`;

  console.log(`
${chalk.blue('i')} ${openLocation
  ? `Server ${httpLocation} will open automatically once everything is ready. This might take a while.`
  : `Server ${httpLocation} running. It might take a while to load.`
}
${chalk.yellow('!')} Preview GSDevTools don't work on parallel. More info here: https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy
${chalk.grey.bold('-------------------------------------------------------')}
  `);

  const app = express();

  app.listen(port, () => {});

  const ports = await new Promise(res => portfinder.getPorts(N_SUBSERVERS, {}, (err, ports) => res(ports)))

  await Promise.all(settingsList
  // spread work evenly into chunks
  .reduce((acc, v, i) => {
    acc[i % N_SUBSERVERS].push(v)
    return acc
  }, Array.from({length: N_SUBSERVERS}, () => []))
  // if we have empty chunks (less than N_SUBSERVERS banners)
  .filter(e => e.length)
  // map to promises
  .map((chunk, i) => {
    // delete row since it's an object with constructor and we can't carry it to the thread
    chunk = chunk.map(({row, ...config}) => config)

    const port = ports[i]

    chunk.forEach(config => {
      const name = getNameFromLocation(config.location);
      app.use(`/${name}/`, (req, res, next) => {
        res.redirect(`http://localhost:${port}/${name}/`)
      })
    })

    return new Promise(res => devSubServer({configs: chunk, options, port}, res))
  }));

  progressBar.stop();
  
  app.use('/', express.static(path.join(__dirname, '../preview/dist')));
  
  openLocation && open(httpLocation);

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
  process.stdin.resume(); //so the program will not close instantly

  function exitHandler(options, exitCode) {
    if (options.cleanup) removeTempRichmediaRcSync(configs);
    if (exitCode || exitCode === 0) console.log(exitCode);
    if (options.exit) process.exit();
    workerFarm.end(devSubServer)
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
};
