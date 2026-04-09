const fs = require('fs');

const FILE_PATH = String.raw`c:\Games\Roberts Space Industries\StarCitizen\LIVE\Data\Localization\english\global.ini`;
const CSV_PATH = String.raw`c:\Games\Roberts Space Industries\StarCitizen\LIVE\Data\Localization\english\powerplants.csv`;

function parseCSVLine(line) {
  const result = []; let current = ''; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { current += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { result.push(current.trim()); current = ''; }
      else { current += c; }
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = values[idx] || ''; });
    return obj;
  });
}

function nameKeyToDescKey(nameKey) {
  return nameKey.replace(/(item_)(Name|name|NAME)/, (m, prefix, word) => {
    if (word === 'name') return prefix + 'desc';
    if (word === 'NAME') return prefix + 'DESC';
    return prefix + 'Desc';
  });
}

function getAlternateDescKeys(descKey) {
  const alts = new Set();
  // Strip _SCItem suffix
  if (descKey.endsWith('_SCItem')) {
    alts.add(descKey.slice(0, -7));
  }
  // Toggle underscore between Desc and POWR (item_DescPOWR_ <-> item_Desc_POWR_)
  const toggled = descKey.replace(/(item_(?:Desc|desc|DESC))(_?)(POWR)/i, (m, prefix, sep, cat) => {
    return prefix + (sep ? '' : '_') + cat;
  });
  if (toggled !== descKey) alts.add(toggled);
  // Both: strip _SCItem AND toggle underscore
  if (descKey.endsWith('_SCItem')) {
    const stripped = descKey.slice(0, -7);
    const toggledStripped = stripped.replace(/(item_(?:Desc|desc|DESC))(_?)(POWR)/i, (m, prefix, sep, cat) => {
      return prefix + (sep ? '' : '_') + cat;
    });
    if (toggledStripped !== stripped) alts.add(toggledStripped);
  }
  alts.delete(descKey); // don't include the primary key
  return [...alts];
}

function fmtNum(val) {
  if (!val && val !== 0) return '0';
  const s = String(val).replace(/,/g, '');
  const num = parseFloat(s);
  if (isNaN(num)) return String(val);
  return num.toLocaleString('en-US');
}

function extractFlavorText(value) {
  const parts = value.split('\\n\\n');
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].trim();
    if (!lastPart.startsWith('--')) return lastPart;
  }
  return '';
}

function buildValue(r, flavorText) {
  let clsLine = r['Class'] ? `\\nClass: ${r['Class']}` : '';
  let val = `Item Type: Power Plant` +
    `\\nManufacturer: ${r['Manufacturer']}` +
    `\\nSize: ${r['Size']}` +
    `\\nGrade: ${r['Grade']}` +
    clsLine +
    `\\n\\n-- Power Stats --` +
    `\\nPower Generation: ${fmtNum(r['Power Generation'])}` +
    `\\n\\n-- Emission --` +
    `\\nEM Max: ${fmtNum(r['EM Max'])}` +
    `\\n\\n-- Durability & Distortion --` +
    `\\nHealth: ${fmtNum(r['Health'])}` +
    `\\nDistortion Shutdown Dmg: ${fmtNum(r['Distortion Shutdown Dmg'])}` +
    `\\nDistortion Decay Delay: ${r['Distortion Decay Delay']}s` +
    `\\nDistortion Decay Rate: ${r['Distortion Decay Rate']}` +
    `\\nDistortion Warning Ratio: ${r['Distortion Warning Ratio']}`;

  if (flavorText) val += `\\n\\n${flavorText}`;
  return val;
}

// --- Main ---
const rows = parseCSV(fs.readFileSync(CSV_PATH, 'utf-8'));
let content = fs.readFileSync(FILE_PATH, 'utf-8');
if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
let lines = content.split('\n');

const existingKeys = {};
for (let i = 0; i < lines.length; i++) {
  const eqIdx = lines[i].indexOf('=');
  if (eqIdx > -1) existingKeys[lines[i].substring(0, eqIdx)] = i;
}

let updatedCount = 0, newCount = 0, skippedCount = 0;
const newLines = [];
let lastDescIdx = -1;

for (const [key, idx] of Object.entries(existingKeys)) {
  if (key.toLowerCase().includes('descpowr_') || key.toLowerCase().includes('desc_powr_')) {
    if (idx > lastDescIdx) lastDescIdx = idx;
  }
}

for (const r of rows) {
  const nameKey = r['Localization Key'];
  if (!nameKey || nameKey === 'N/A') { skippedCount++; continue; }

  const descKey = nameKeyToDescKey(nameKey);
  const altKeys = getAlternateDescKeys(descKey);
  const allKeys = [descKey, ...altKeys];
  let primaryUpdated = false;

  for (const targetKey of allKeys) {
    let foundKey = null, foundIdx = -1;
    if (targetKey in existingKeys) { foundKey = targetKey; foundIdx = existingKeys[targetKey]; }
    else {
      const lc = targetKey.toLowerCase();
      for (const [k, idx] of Object.entries(existingKeys)) {
        if (k.toLowerCase() === lc) { foundKey = k; foundIdx = idx; break; }
      }
    }

    if (foundKey !== null) {
      const oldLine = lines[foundIdx];
      const eqIdx = oldLine.indexOf('=');
      const oldValue = eqIdx > -1 ? oldLine.substring(eqIdx + 1) : '';
      const flavor = extractFlavorText(oldValue);
      lines[foundIdx] = `${foundKey}=${buildValue(r, flavor)}`;
      primaryUpdated = true;
    }
  }

  if (primaryUpdated) {
    updatedCount++;
  } else {
    newLines.push(`${descKey}=${buildValue(r, '')}`);
    newCount++;
  }
}

if (newLines.length > 0 && lastDescIdx > -1) {
  newLines.sort();
  for (let i = 0; i < newLines.length; i++) lines.splice(lastDescIdx + 1 + i, 0, newLines[i]);
} else if (newLines.length > 0) {
  lines.push(...newLines.sort());
}

fs.writeFileSync(FILE_PATH, '\ufeff' + lines.join('\n'), 'utf-8');
console.log(`Power Plants: Updated ${updatedCount}, Added ${newCount}, Skipped ${skippedCount}`);
console.log('Done!');
