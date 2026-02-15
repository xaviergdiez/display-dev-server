const fs = require('fs-extra');
const path = require('path');

module.exports = function addConfigsAsWebpackDependencies(filePath, loaderContext) {
  loaderContext.addDependency(filePath);

  try {
    const rawConfigJson = fs.readJSONSync(filePath);

    if (rawConfigJson.parent) {
      const newPath = path.resolve(path.dirname(filePath), rawConfigJson.parent);
      addConfigsAsWebpackDependencies(newPath, loaderContext);
    }

  } catch (e) {

  }
}
