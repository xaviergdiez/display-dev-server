'use strict';

const fs = require('fs-extra');
const path = require('path');

module.exports = class CopyFilesPlugin {
  constructor(options) {
    this.options = options;
  }

  apply(compiler) {
    compiler.hooks.thisCompilation.tap('CopyFilesPlugin', compilation => {
      const {webpack} = compiler;
      const {Compilation} = webpack;
      const {RawSource} = webpack.sources;

      const outputPath = compilation.compiler.outputPath;
      const inputPath = this.options.fromPath;
      const files = fs.readdirSync(inputPath)

      files.forEach(file => {
        const absFilePath = path.resolve(inputPath, file);

        if (compilation.compiler.options.mode === 'production') {
          if (!fs.pathExistsSync(path.resolve(outputPath))) fs.mkdirSync(path.resolve(outputPath), {recursive: true});
          fs.copyFileSync(absFilePath, path.resolve(outputPath, file));
        } else {

          const content = fs.readFileSync(absFilePath)

          compilation.fileDependencies.add(absFilePath);
          compilation.emitAsset(
            file,
            new RawSource(content)
          );
        }
      })
    });
  }
};
