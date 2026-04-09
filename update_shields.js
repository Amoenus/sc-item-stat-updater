const fs = require('fs');
const path = require('path');

const FILE_PATH = String.raw`c:\Games\Roberts Space Industries\StarCitizen\LIVE\Data\Localization\english\global.ini`;

const shields = [
  { key: "item_DescSHLD_BEHR_S03_5CA", manufacturer: "Behring", size: 3, grade: "C", cls: "Civilian", pool_hp: "125,000", max_shield_gen: "11,875", min_regen: "10.53s", power: 4, dmg_regen_delay: "6.05s", down_regen_delay: "12.1s", phys_res: "0 / 25 %", energy_res: "-58 / -19 %", dist_res: "75 / 95 %", phys_abs: "0 / 45 %", energy_abs: "100 / 100 %", dist_abs: "100 / 100 %", em_max: "1,800", health: "1,100", dist_shutdown: "5,500", dist_decay_delay: "4.5s", dist_decay_rate: "366.67", dist_warning: "0.75" },
  { key: "item_DescSHLD_SECO_S01_WEB", manufacturer: "Seal Corporation", size: 1, grade: "C", cls: "Civilian", pool_hp: "2,700", max_shield_gen: "257", min_regen: "10.51s", power: 2, dmg_regen_delay: "5s", down_regen_delay: "10s", phys_res: "0 / 25 %", energy_res: "-86 / -29 %", dist_res: "75 / 95 %", phys_abs: "0 / 45 %", energy_abs: "100 / 100 %", dist_abs: "100 / 100 %", em_max: "750", health: "150", dist_shutdown: "2,250", dist_decay_delay: "1.5s", dist_decay_rate: "150", dist_warning: "0.75" },
];

function buildValue(s, flavorText) {
  let clsLine = s.cls ? `\\nClass: ${s.cls}` : '';
  let val = `Item Type: Shield Generator` +
    `\\nManufacturer: ${s.manufacturer}` +
    `\\nSize: ${s.size}` +
    `\\nGrade: ${s.grade}` +
    clsLine +
    `\\n\\n-- Shield Stats --` +
    `\\nPool HP: ${s.pool_hp}` +
    `\\nMax Shield Generation: ${s.max_shield_gen}` +
    `\\nMin Regen Time: ${s.min_regen}` +
    `\\nDamaged Regen Delay: ${s.dmg_regen_delay}` +
    `\\nDowned Regen Delay: ${s.down_regen_delay}` +
    `\\n\\n-- Resistances (Min/Max) --` +
    `\\nPhysical: ${s.phys_res}` +
    `\\nEnergy: ${s.energy_res}` +
    `\\nDistortion: ${s.dist_res}` +
    `\\n\\n-- Absorption (Min/Max) --` +
    `\\nPhysical: ${s.phys_abs}` +
    `\\nEnergy: ${s.energy_abs}` +
    `\\nDistortion: ${s.dist_abs}` +
    `\\n\\n-- Power & Emission --` +
    `\\nPower Consumption: ${s.power}` +
    `\\nEM Max: ${s.em_max}` +
    `\\n\\n-- Durability & Distortion --` +
    `\\nHealth: ${s.health}` +
    `\\nDistortion Shutdown Dmg: ${s.dist_shutdown}` +
    `\\nDistortion Decay Delay: ${s.dist_decay_delay}` +
    `\\nDistortion Decay Rate: ${s.dist_decay_rate}` +
    `\\nDistortion Warning Ratio: ${s.dist_warning}`;

  if (flavorText) {
    val += `\\n\\n${flavorText}`;
  }

  return val;
}

function extractFlavorText(value) {
  const parts = value.split('\\n\\n');
  if (parts.length > 1) {
    return parts.slice(1).join('\\n\\n').trim();
  }
  return '';
}

// Read file
let content = fs.readFileSync(FILE_PATH, 'utf-8');
// Remove BOM if present
if (content.charCodeAt(0) === 0xFEFF) {
  content = content.slice(1);
}

let lines = content.split('\n');

// Build dict of existing key -> line index
const existingKeys = {};
for (let i = 0; i < lines.length; i++) {
  const eqIdx = lines[i].indexOf('=');
  if (eqIdx > -1) {
    const key = lines[i].substring(0, eqIdx);
    if (key.startsWith('item_DescSHLD_')) {
      existingKeys[key] = i;
    }
  }
}

let updatedCount = 0;
let newCount = 0;
const newLines = [];

for (const s of shields) {
  const key = s.key;
  if (key in existingKeys) {
    const idx = existingKeys[key];
    const oldLine = lines[idx];
    const eqIdx = oldLine.indexOf('=');
    const oldValue = eqIdx > -1 ? oldLine.substring(eqIdx + 1) : '';
    const flavor = extractFlavorText(oldValue);
    const newValue = buildValue(s, flavor);
    lines[idx] = `${key}=${newValue}`;
    updatedCount++;
  } else {
    const newValue = buildValue(s, '');
    newLines.push(`${key}=${newValue}`);
    newCount++;
  }
}

// Insert new lines after the last shield desc line
if (newLines.length > 0 && Object.keys(existingKeys).length > 0) {
  const lastIdx = Math.max(...Object.values(existingKeys));
  newLines.sort();
  for (let i = 0; i < newLines.length; i++) {
    lines.splice(lastIdx + 1 + i, 0, newLines[i]);
  }
}

// Write back with UTF-8 BOM
const result = '\ufeff' + lines.join('\n');
fs.writeFileSync(FILE_PATH, result, 'utf-8');

console.log(`Updated ${updatedCount} existing entries`);
console.log(`Added ${newCount} new entries`);
console.log('Done!');
