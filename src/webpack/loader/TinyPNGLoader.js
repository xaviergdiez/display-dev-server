const loaderUtils = require("loader-utils");
const subsetFont = require("subset-font");
const getRichmediaRC = require("../../util/getRichmediaRC");
const getObjectByString = require("../../util/getObjectByString");
const path = require("path");
const fs = require("fs-extra");
const chalk = require("chalk");
// const get = require("lodash.get");
const {TinyPNG} = require("tinypng");

module.exports = async function (content) {
  const callback = this.async();
  const options = loaderUtils.getOptions(this);
  const {apiKey} = options;

  const client = new TinyPNG(apiKey);
  const file = await client.compress(content);
  callback(null, file.data);
};

module.exports.raw = true;
