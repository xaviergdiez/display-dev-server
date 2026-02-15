const fs = require('fs');

module.exports = function isFile(val) {
  if (fs.existsSync(val) && fs.statSync(val).isFile()) {
    return true;
  } else {
    return false;
  }
};
