'use strict';

const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver')

module.exports = class ZipFilesPlugin {
  constructor(options) {
    this.options = options;
  }

  async zipFiles(options, compilation) {
    const {outputPath, filename} = this.options;
    const inputFilesPath = compilation.compiler.outputPath;
    const inputFiles = fs.readdirSync(path.resolve(inputFilesPath))

    // write the zip file containing all zips
    await new Promise((resolve) => {
      const output = fs.createWriteStream(path.resolve(outputPath, filename));
      output.on("close", resolve);
      const archive = archiver("zip", {
        zlib: {level: 9}, // Sets the compression level.
      });
      archive.pipe(output);
      inputFiles.forEach((file) => archive.file(path.resolve(inputFilesPath, file), {name: file}));
      archive.finalize();
    });
  }

  apply(compiler) {
    compiler.hooks.afterEmit.tapPromise('ZipFilesPlugin', async compilation => {
      await this.zipFiles(this.options, compilation);
    });
  }
};
