const fs = require('fs');

const FILE_PATH = String.raw`c:\Games\Roberts Space Industries\StarCitizen\LIVE\Data\Localization\english\global.ini`;
const CSV_PATH = String.raw`c:\Games\Roberts Space Industries\StarCitizen\LIVE\Data\Localization\english\coolers.csv`;

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
  let val = `Item Type: Cooler` +
    `\\nManufacturer: ${r['Manufacturer']}` +
    `\\nSize: ${r['Size']}` +
    `\\nGrade: ${r['Grade']}` +
    clsLine +
    `\\n\\n-- Cooling Stats --` +
    `\\nCooling Generation: ${fmtNum(r['Cooling Generation'])}` +
    `\\n\\n-- Power & Emission --` +
    `\\nPower Consumption: ${r['Power Consumption']}` +
    `\\nEM Max: ${fmtNum(r['EM Max'])}` +
    `\\nIR Max: ${fmtNum(r['IR Max'])}` +
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
  if (key.toLowerCase().includes('desccool_') || key.toLowerCase().includes('desc_cool_')) {
    if (idx > lastDescIdx) lastDescIdx = idx;
  }
}

for (const r of rows) {
  const nameKey = r['Localization Key'];
  if (!nameKey || nameKey === 'N/A') { skippedCount++; continue; }

  const descKey = nameKeyToDescKey(nameKey);
  let foundKey = null, foundIdx = -1;
  if (descKey in existingKeys) { foundKey = descKey; foundIdx = existingKeys[descKey]; }
  else {
    const lc = descKey.toLowerCase();
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
console.log(`Coolers: Updated ${updatedCount}, Added ${newCount}, Skipped ${skippedCount}`);
console.log('Done!');
