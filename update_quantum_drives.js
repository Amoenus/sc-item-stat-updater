const fs = require('fs');
const path = require('path');

const FILE_PATH = String.raw`c:\Games\Roberts Space Industries\StarCitizen\LIVE\Data\Localization\english\global.ini`;
const CSV_PATH = String.raw`c:\Games\Roberts Space Industries\StarCitizen\LIVE\Data\Localization\english\quantum_drives.csv`;

// --- CSV parser ---
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
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
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = values[idx] || ''; });
    rows.push(obj);
  }
  return rows;
}

// --- Key derivation ---
function nameKeyToDescKey(nameKey) {
  return nameKey.replace(/(item_)(Name|name|NAME)/, (match, prefix, word) => {
    if (word === 'name') return prefix + 'desc';
    if (word === 'NAME') return prefix + 'DESC';
    return prefix + 'Desc';
  });
}

// --- Number formatter ---
function fmtNum(val) {
  if (!val && val !== 0) return '0';
  const s = String(val).replace(/,/g, '');
  const num = parseFloat(s);
  if (isNaN(num)) return String(val);
  return num.toLocaleString('en-US');
}

// --- Flavor text extraction ---
function extractFlavorText(value) {
  // Find the last stat section, then look for text after a double newline that isn't a section header
  const parts = value.split('\\n\\n');
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].trim();
    // If the last part doesn't start with "--" it's flavor text
    if (!lastPart.startsWith('--')) {
      return lastPart;
    }
  }
  return '';
}

// --- Build description ---
function buildValue(r, flavorText) {
  let clsLine = r['Class'] ? `\\nClass: ${r['Class']}` : '';
  let val = `Item Type: Quantum Drive` +
    `\\nManufacturer: ${r['Manufacturer']}` +
    `\\nSize: ${r['Size']}` +
    `\\nGrade: ${r['Grade']}` +
    clsLine +
    `\\n\\n-- Drive Stats --` +
    `\\nMax Speed: ${fmtNum(r['Max Speed km/s'])} km/s (${r['Max Speed c']}c)` +
    `\\nSpline Max Speed: ${fmtNum(r['Spline Max Speed km/s'])} km/s` +
    `\\nSpool Up Time: ${r['Spool Up Time']}s` +
    `\\nCooldown Time: ${r['Cooldown Time']}s` +
    `\\nStage 1 Accel: ${fmtNum(r['Stage One Acceleration'])}` +
    `\\nStage 2 Accel: ${fmtNum(r['Stage Two Acceleration'])}` +
    `\\n\\n-- Calibration --` +
    `\\nDelay: ${r['Calibration Delay']}s` +
    `\\nRate: ${fmtNum(r['Calibration Rate'])}` +
    `\\nMin/Max: ${fmtNum(r['Calibration Min'])} / ${fmtNum(r['Calibration Max'])}` +
    `\\nDisconnect Range: ${fmtNum(r['Disconnect Range'])}` +
    `\\n\\n-- Power & Efficiency --` +
    `\\nPower Consumption: ${r['Power Consumption']}` +
    `\\nFuel Requirement: ${r['Quantum Fuel Requirement']}` +
    `\\nEfficiency: ${r['Efficiency']}` +
    `\\nEM Max: ${fmtNum(r['EM Max'])}` +
    `\\n\\n-- Durability & Resistance --` +
    `\\nHealth: ${fmtNum(r['Health'])}` +
    `\\nDistortion Shutdown Dmg: ${fmtNum(r['Distortion Shutdown Dmg'])}` +
    `\\nDistortion Decay Delay: ${r['Distortion Decay Delay']}s` +
    `\\nDistortion Decay Rate: ${r['Distortion Decay Rate']}` +
    `\\nDistortion Warning Ratio: ${r['Distortion Warning Ratio']}` +
    `\\nInterdiction Effect Time: ${r['Interdiction Effect Time']}s`;

  if (flavorText) {
    val += `\\n\\n${flavorText}`;
  }
  return val;
}

// --- Main ---
const csvText = fs.readFileSync(CSV_PATH, 'utf-8');
const rows = parseCSV(csvText);

let content = fs.readFileSync(FILE_PATH, 'utf-8');
if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
let lines = content.split('\n');

// Build index of existing desc keys (case-insensitive lookup)
const existingKeys = {};
for (let i = 0; i < lines.length; i++) {
  const eqIdx = lines[i].indexOf('=');
  if (eqIdx > -1) {
    const key = lines[i].substring(0, eqIdx);
    existingKeys[key] = i;
  }
}

let updatedCount = 0;
let newCount = 0;
let skippedCount = 0;
const newLines = [];
const descKeyPrefix = 'item_DescQDRV_';
let lastDescIdx = -1;

// Find the last existing QDRV desc line
for (const [key, idx] of Object.entries(existingKeys)) {
  if (key.toLowerCase().includes('descqdrv_') || key.toLowerCase().includes('desc_qdrv_') || key.toLowerCase().includes('desc_qrdv_')) {
    if (idx > lastDescIdx) lastDescIdx = idx;
  }
}

for (const r of rows) {
  const nameKey = r['Localization Key'];
  if (!nameKey || nameKey === 'N/A') { skippedCount++; continue; }

  const descKey = nameKeyToDescKey(nameKey);

  // Try exact match first, then case-insensitive
  let foundKey = null;
  let foundIdx = -1;
  if (descKey in existingKeys) {
    foundKey = descKey;
    foundIdx = existingKeys[descKey];
  } else {
    const descKeyLower = descKey.toLowerCase();
    for (const [k, idx] of Object.entries(existingKeys)) {
      if (k.toLowerCase() === descKeyLower) {
        foundKey = k;
        foundIdx = idx;
        break;
      }
    }
  }

  if (foundKey !== null) {
    const oldLine = lines[foundIdx];
    const eqIdx = oldLine.indexOf('=');
    const oldValue = eqIdx > -1 ? oldLine.substring(eqIdx + 1) : '';
    const flavor = extractFlavorText(oldValue);
    const newValue = buildValue(r, flavor);
    lines[foundIdx] = `${foundKey}=${newValue}`;
    updatedCount++;
  } else {
    const newValue = buildValue(r, '');
    newLines.push(`${descKey}=${newValue}`);
    newCount++;
  }
}

// Insert new lines after the last desc line for this category
if (newLines.length > 0 && lastDescIdx > -1) {
  newLines.sort();
  for (let i = 0; i < newLines.length; i++) {
    lines.splice(lastDescIdx + 1 + i, 0, newLines[i]);
  }
} else if (newLines.length > 0) {
  // Append to end if no existing entries found
  lines.push(...newLines.sort());
}

const result = '\ufeff' + lines.join('\n');
fs.writeFileSync(FILE_PATH, result, 'utf-8');

console.log(`Quantum Drives: Updated ${updatedCount}, Added ${newCount}, Skipped ${skippedCount}`);
console.log('Done!');
