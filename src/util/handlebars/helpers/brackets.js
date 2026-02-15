module.exports = function(num, options = num) {
    const i = Number.isInteger(num) ? num : 1;
    const open = '{'.repeat(i);
    const close = '}'.repeat(i);
    return `${open}${options.fn(this)}${close}`;
};
