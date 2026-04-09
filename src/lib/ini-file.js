const fs = require('fs');

function readIniFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  return content.split('\n');
}

function writeIniFile(filePath, lines) {
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, filePath + '.backup');
  }
  fs.writeFileSync(filePath, '\ufeff' + lines.join('\n'), 'utf-8');
}

function buildKeyIndex(lines) {
  const index = {};
  for (let i = 0; i < lines.length; i++) {
    const eqIdx = lines[i].indexOf('=');
    if (eqIdx > -1) index[lines[i].substring(0, eqIdx)] = i;
  }
  return index;
}

module.exports = { readIniFile, writeIniFile, buildKeyIndex };
