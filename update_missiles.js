const fs = require('fs');

const FILE_PATH = String.raw`c:\Games\Roberts Space Industries\StarCitizen\LIVE\Data\Localization\english\global.ini`;
const CSV_PATH = String.raw`c:\Games\Roberts Space Industries\StarCitizen\LIVE\Data\Localization\english\missiles.csv`;

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
  const isTorpedo = parseInt(r['Size']) >= 7;
  const itemType = isTorpedo ? 'Torpedo' : 'Missile';

  let val = `Item Type: ${itemType}` +
    `\\nManufacturer: ${r['Manufacturer']}` +
    `\\nTracking Signal: ${r['Tracking Signal Type']}` +
    `\\nSize: ${r['Size']}` +
    `\\n\\n-- Damage --` +
    `\\nTotal Damage: ${fmtNum(r['Dmg Total'])}`;

  if (r['Dmg Physical'] && r['Dmg Physical'] !== '0') val += `\\nPhysical: ${fmtNum(r['Dmg Physical'])}`;
  if (r['Dmg Energy'] && r['Dmg Energy'] !== '0') val += `\\nEnergy: ${fmtNum(r['Dmg Energy'])}`;
  if (r['Dmg Distortion'] && r['Dmg Distortion'] !== '0') val += `\\nDistortion: ${fmtNum(r['Dmg Distortion'])}`;

  if (r['Cluster Count'] && r['Cluster Count'] !== '0') {
    val += `\\nCluster Count: ${r['Cluster Count']}`;
  }

  val += `\\n\\n-- Flight Stats --` +
    `\\nSpeed: ${fmtNum(r['Speed'])} m/s` +
    `\\nArm Time: ${r['Arm Time']}s` +
    `\\nLock Time: ${r['Lock Time']}s` +
    `\\nLocking Angle: ${r['Locking Angle']}°` +
    `\\nLock Range: ${fmtNum(r['Lock Range Min'])} - ${fmtNum(r['Lock Range Max'])}m` +
    `\\nIgnite Time: ${r['Ignite Time']}s` +
    `\\n\\n-- Explosion --` +
    `\\nRadius: ${r['Explosion Radius Min']} - ${r['Explosion Radius Max']}m` +
    `\\nHealth: ${fmtNum(r['Health'])}`;

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
  const kl = key.toLowerCase();
  if (kl.includes('descmisl_') || kl.includes('descgmisl_')) {
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
console.log(`Missiles: Updated ${updatedCount}, Added ${newCount}, Skipped ${skippedCount}`);
console.log('Done!');
