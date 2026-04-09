function fmtNum(val) {
  if (!val && val !== 0) return '0';
  const s = String(val).replace(/,/g, '');
  const num = parseFloat(s);
  if (isNaN(num)) return String(val);
  return num.toLocaleString('en-US');
}

module.exports = { fmtNum };
