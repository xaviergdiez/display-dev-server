module.exports = async function (content) {
  const callback = this.async();
  console.log(content.toString('utf-8'))
  callback(null, content);
};

module.exports.raw = true;
