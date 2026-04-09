import { fmtNum } from '../lib/formatter.js';

export default {
  csvFile: 'coolers.csv',
  label: 'Coolers',
  descKeyMatch: (kl) => kl.includes('desccool_') || kl.includes('desc_cool_'),
  buildValue(r, flavorText) {
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
  },
};
