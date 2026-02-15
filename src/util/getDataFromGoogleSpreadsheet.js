const getGoogleSheetIdFromUrl = require("../util/getGoogleSheetIdFromUrl");
const chalk = require('chalk');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const isGoogleSpreadsheetUrl = require('./isGoogleSpreadsheetUrl');
const getOAuth2Client = require('./getOAuth2Client');

module.exports = async function getDataFromGoogleSpreadsheet(contentSource) {
  const cacheSpreadSheets = {};
  const id = getGoogleSheetIdFromUrl(contentSource.url);

  if (!isGoogleSpreadsheetUrl(contentSource.url)) {
    throw new Error('settings.contentSource.url is not a valid google spreadsheet url.');
  }

  console.log(`${chalk.green('✔')} gathering google sheets data for ${id}`);
  cacheSpreadSheets[id] = new GoogleSpreadsheet(id);

  if (contentSource.hasOwnProperty('apiKey') || process.env.displayMonks_googleApiKey) {
    console.log(`${chalk.green('✔')} using API key`);
    const apiKey = contentSource.apiKey || process.env.displayMonks_googleApiKey;
    cacheSpreadSheets[id].useApiKey(apiKey);
  } else {
    console.log(`${chalk.green('✔')} no API key found, defaulting to OAuth2`);
    const oAuth2Client = await getOAuth2Client();
    cacheSpreadSheets[id].useOAuth2Client(oAuth2Client);
  }

  await cacheSpreadSheets[id].loadInfo();

  const doc = cacheSpreadSheets[id];
  let sheet;

  if (contentSource.tabName) {
    sheet = doc.sheetsByTitle[contentSource.tabName];

    if (!sheet) {
      console.log(
        `${chalk.green(
          '✔',
        )} Selecting first tab from sheet because tabName was incorrectly named (check tabNames in spreadsheet).`,
      );
      sheet = doc.sheetsByIndex[0];
    } else {
      console.log(`${chalk.green('✔')} Selecting "${contentSource.tabName}" from sheet.`);
    }
  } else {
    console.log(
      `${chalk.green('✔')} Selecting first tab from sheet because tabName was not defined.`,
    );
    sheet = doc.sheetsByIndex[0];
  }

  const rows = await sheet.getRows();
  const headerValues = sheet.headerValues;

  return {
    rows,
    headerValues
  };
}
