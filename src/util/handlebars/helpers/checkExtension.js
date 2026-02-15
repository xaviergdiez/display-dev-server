module.exports = function (value, checkStr, options) {
  let arr = checkStr.split('|');

  for(let item of arr){
    if(value.endsWith(item)){
      return options.fn(this);
    }
  }

  return options.inverse(this);
};
