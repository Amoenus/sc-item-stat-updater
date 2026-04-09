const fs = require('fs');
const path = require('path');
const { parseCSV } = require('./csv-parser');
const { readIniFile, writeIniFile, buildKeyIndex } = require('./ini-file');
const { extractFlavorText } = require('./text-utils');

/**
 * Runs a CSV-based update against global.ini.
 *
 * @param {object} config
 * @param {string} config.csvFile - CSV filename (relative to csvDir)
 * @param {string} config.label - Display label for logging (e.g. "Coolers")
 * @param {function} config.buildValue - (row, flavorText) => string
 * @param {function} config.descKeyMatch - (keyLowerCase) => boolean — identifies existing desc keys for insertion point
 * @param {function} [config.nameKeyToDescKey] - override key derivation
 * @param {function} [config.getAlternateDescKeys] - (descKey) => string[] — extra keys to check (e.g. powerplants)
 * @param {object} [options]
 * @param {string} [options.iniPath] - Path to global.ini (default: ./global.ini relative to project root)
 * @param {string} [options.csvDir] - Directory containing CSV files (default: project root)
 * @param {boolean} [options.dryRun] - Preview changes without writing (default: false)
 */
function runUpdate(config, options = {}) {
  const { nameKeyToDescKey: defaultNameKeyToDescKey } = require('./text-utils');

  const baseDir = path.resolve(__dirname, '..', '..');
  const iniPath = options.iniPath || path.join(baseDir, 'global.ini');
  const csvDir = options.csvDir || baseDir;
  const dryRun = options.dryRun || false;

  const csvPath = path.join(csvDir, config.csvFile);

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }
  if (!fs.existsSync(iniPath)) {
    throw new Error(`INI file not found: ${iniPath}`);
  }

  const rows = parseCSV(fs.readFileSync(csvPath, 'utf-8'));
  const lines = readIniFile(iniPath);
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

  if (!dryRun) {
    writeIniFile(iniPath, lines);
  }
  const suffix = dryRun ? ' (dry run)' : '';
  const summary = `${config.label}: Updated ${updatedCount}, Added ${newCount}, Skipped ${skippedCount}${suffix}`;
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
