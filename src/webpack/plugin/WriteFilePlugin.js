'use strict';

const fs = require('fs-extra');
const path = require('path');

module.exports = class WriteFilePlugin {
  constructor(options) {
    if (!options) {
      throw new Error(`Please provide 'options' for the WriteFilePlugin config`);
    }

    const missingOptions = [];

    // if (options.filePath == null) missingOptions.push('filePath');
    if (options.fileName == null) missingOptions.push('fileName');
    if (options.content == null) missingOptions.push('content');

    if (missingOptions.length)
      throw new Error(
        `Please provide the following option${missingOptions.length > 1 ? 's' : ''
        } in the WriteFilePlugin config: ${missingOptions.join(', ')}`
      );

    this.options = options;
  }

  createFile({fileName, content}, compilation) {
    // console.log(compilation.compiler.outputPath)

    const fullPath = path.join(compilation.compiler.outputPath, fileName);
    const contentData = typeof content === 'function' ? content({fileName, compilation}) : content;
    fs.outputFileSync(fullPath, contentData);
  }

  apply(compiler) {
    compiler.hooks.afterEmit.tapPromise('WriteFilePlugin', async compilation => {
      this.createFile(this.options, compilation);
    });
  }
};
