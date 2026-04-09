import { fmtNum } from '../lib/formatter.js';

export default {
  csvFile: 'shields.csv',
  label: 'Shields',
  descKeyMatch: (kl) => kl.includes('descshld_') || kl.includes('desc_shld_'),
  buildValue(r, flavorText) {
    const clsLine = r['Class'] ? `\\nClass: ${r['Class']}` : '';
    let val =
      `Item Type: Shield Generator` +
      `\\nManufacturer: ${r['Manufacturer']}` +
      `\\nSize: ${r['Size']}` +
      `\\nGrade: ${r['Grade']}` +
      clsLine +
      `\\n\\n-- Shield Stats --` +
      `\\nPool HP: ${fmtNum(r['Pool HP'])}` +
      `\\nMax Shield Generation: ${fmtNum(r['Max Shield Generation'])}` +
      `\\nMin Regen Time: ${r['Min Regen Time (0 to full)']}` +
      `\\nDamaged Regen Delay: ${r['Damaged Regen Delay']}` +
      `\\nDowned Regen Delay: ${r['Downed Regen Delay']}` +
      `\\n\\n-- Resistances (Min/Max) --` +
      `\\nPhysical: ${r['Physical Resistance Min / Max']}` +
      `\\nEnergy: ${r['Energy Resistance Min / Max']}` +
      `\\nDistortion: ${r['Distortion Resistance Min / Max']}` +
      `\\n\\n-- Absorption (Min/Max) --` +
      `\\nPhysical: ${r['Physical Absorption Min / Max']}` +
      `\\nEnergy: ${r['Energy Absorption Min / Max']}` +
      `\\nDistortion: ${r['Distortion Absorption Min / Max']}` +
      `\\n\\n-- Power & Emission --` +
      `\\nPower Consumption: ${r['Power Consumption']}` +
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
