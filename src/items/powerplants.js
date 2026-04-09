import { fmtNum } from '../lib/formatter.js';

function getAlternateDescKeys(descKey) {
  const alts = new Set();
  if (descKey.endsWith('_SCItem')) {
    alts.add(descKey.slice(0, -7));
  }
  const toggled = descKey.replace(/(item_(?:Desc|desc|DESC))(_?)(POWR)/i, (m, prefix, sep, cat) => {
    return prefix + (sep ? '' : '_') + cat;
  });
  if (toggled !== descKey) alts.add(toggled);
  if (descKey.endsWith('_SCItem')) {
    const stripped = descKey.slice(0, -7);
    const toggledStripped = stripped.replace(/(item_(?:Desc|desc|DESC))(_?)(POWR)/i, (m, prefix, sep, cat) => {
      return prefix + (sep ? '' : '_') + cat;
    });
    if (toggledStripped !== stripped) alts.add(toggledStripped);
  }
  alts.delete(descKey);
  return [...alts];
}

export default {
  csvFile: 'powerplants.csv',
  label: 'Power Plants',
  descKeyMatch: (kl) => kl.includes('descpowr_') || kl.includes('desc_powr_'),
  getAlternateDescKeys,
  buildValue(r, flavorText) {
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
  },
};
