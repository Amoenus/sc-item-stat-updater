const fs = require('fs');
const path = require('path');
const { parseCSV } = require('./csv-parser');
const { readIniFile, writeIniFile, buildKeyIndex } = require('./ini-file');
const { extractFlavorText } = require('./text-utils');

const BASE_DIR = path.resolve(__dirname, '..', '..');
const INI_PATH = path.join(BASE_DIR, 'global.ini');

/**
 * Runs a CSV-based update against global.ini.
 *
 * @param {object} config
 * @param {string} config.csvFile - CSV filename (relative to base dir)
 * @param {string} config.label - Display label for logging (e.g. "Coolers")
 * @param {function} config.buildValue - (row, flavorText) => string
 * @param {function} config.descKeyMatch - (keyLowerCase) => boolean — identifies existing desc keys for insertion point
 * @param {function} [config.nameKeyToDescKey] - override key derivation
 * @param {function} [config.getAlternateDescKeys] - (descKey) => string[] — extra keys to check (e.g. powerplants)
 */
function runUpdate(config) {
  const { nameKeyToDescKey: defaultNameKeyToDescKey } = require('./text-utils');

  const csvPath = path.join(BASE_DIR, config.csvFile);
  const rows = parseCSV(fs.readFileSync(csvPath, 'utf-8'));
  const lines = readIniFile(INI_PATH);
  const existingKeys = buildKeyIndex(lines);

  const deriveDescKey = config.nameKeyToDescKey || defaultNameKeyToDescKey;

  let updatedCount = 0, newCount = 0, skippedCount = 0;
  const newLines = [];
  let lastDescIdx = -1;

  for (const [key, idx] of Object.entries(existingKeys)) {
    if (config.descKeyMatch(key.toLowerCase())) {
      if (idx > lastDescIdx) lastDescIdx = idx;
    }
  }

  for (const r of rows) {
    const nameKey = r['Localization Key'];
    if (!nameKey || nameKey === 'N/A') { skippedCount++; continue; }

    const descKey = deriveDescKey(nameKey);
    const altKeys = config.getAlternateDescKeys ? config.getAlternateDescKeys(descKey) : [];
    const allKeys = [descKey, ...altKeys];
    let anyUpdated = false;

    for (const targetKey of allKeys) {
      const found = findKey(targetKey, existingKeys);
      if (found) {
        const oldLine = lines[found.idx];
        const eqIdx = oldLine.indexOf('=');
        const oldValue = eqIdx > -1 ? oldLine.substring(eqIdx + 1) : '';
        const flavor = extractFlavorText(oldValue);
        lines[found.idx] = `${found.key}=${config.buildValue(r, flavor)}`;
        anyUpdated = true;
      }
    }

    if (anyUpdated) {
      updatedCount++;
    } else {
      newLines.push(`${descKey}=${config.buildValue(r, '')}`);
      newCount++;
    }
  }

  if (newLines.length > 0 && lastDescIdx > -1) {
    newLines.sort();
    for (let i = 0; i < newLines.length; i++) lines.splice(lastDescIdx + 1 + i, 0, newLines[i]);
  } else if (newLines.length > 0) {
    lines.push(...newLines.sort());
  }

  writeIniFile(INI_PATH, lines);
  const summary = `${config.label}: Updated ${updatedCount}, Added ${newCount}, Skipped ${skippedCount}`;
  return { label: config.label, updatedCount, newCount, skippedCount, summary };
}

function findKey(targetKey, existingKeys) {
  if (targetKey in existingKeys) {
    return { key: targetKey, idx: existingKeys[targetKey] };
  }
  const lc = targetKey.toLowerCase();
  for (const [k, idx] of Object.entries(existingKeys)) {
    if (k.toLowerCase() === lc) return { key: k, idx };
  }
  return null;
}

module.exports = { runUpdate };
