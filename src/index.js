const getWebpackConfigs = require("./webpack/getWebpackConfigs");
const devServer = require("./webpack/devServer");
const devServerParallel = require("./webpack/devServerParallel");
const buildFiles = require("./webpack/buildFiles");
const buildFilesParallel = require("./webpack/buildFilesParallel");
const buildPreview = require("./webpack/buildPreview");
const deleteAllGooglesheetFiles = require("./util/deleteAllGooglesheetFiles");

module.exports = async function (options) {
  // {mode = "development", glob = "./**/.richmediarc*", choices = null, stats = null, outputDir = "./build", configOverride = {}}
  let {mode, glob, choices, stats, outputDir, skipBuild, skipPreview, parallel} = options;

  if (mode == "cleanup") {
    return await deleteAllGooglesheetFiles()
  }

  const webpackConfigs = !skipBuild ? await getWebpackConfigs(options) : null;

  if (mode === "development") {
    if (parallel) await devServerParallel(webpackConfigs.result, webpackConfigs.choices.openLocation, options);
    else          await devServer(webpackConfigs.result, webpackConfigs.choices.openLocation);
  } else {
    let qualities
    if (!skipBuild) {
      if (parallel) qualities = await buildFilesParallel(webpackConfigs.result, options);
      else          qualities = await buildFiles(webpackConfigs.result, outputDir);
    }
    if (!skipPreview) await buildPreview(webpackConfigs?.result, qualities?.ads, outputDir);
  }
};
