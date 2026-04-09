import { fmtNum } from '../lib/formatter.js';

export default {
  csvFile: 'radars.csv',
  label: 'Radars',
  descKeyMatch: (kl) => kl.includes('desc_radr_') || kl.includes('descradr_'),
  buildValue(r, flavorText) {
    const clsLine = r['Class'] ? `\\nClass: ${r['Class']}` : '';
    let val =
      `Item Type: Radar` +
      `\\nManufacturer: ${r['Manufacturer']}` +
      `\\nSize: ${r['Size']}` +
      `\\nGrade: ${r['Grade']}` +
      clsLine +
      `\\n\\n-- Detection --` +
      `\\nMax Detection Range: ${fmtNum(r['Aim Assist Max Dist'])}m` +
      `\\nMin Detection Range: ${fmtNum(r['Aim Assist Min Dist'])}m` +
      `\\nOutside Range Buffer: ${r['Outside Range Buffer']}m` +
      `\\n\\n-- Sensitivity --` +
      `\\nCross Section: ${r['CS Sensitivity']}` +
      `\\nElectromagnetic: ${r['EM Sensitivity']}` +
      `\\nInfrared: ${r['IR Sensitivity']}` +
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
