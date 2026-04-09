import { fmtNum } from '../lib/formatter.js';

export default {
  csvFile: 'qeds.csv',
  label: 'QEDs',
  descKeyMatch: (kl) => kl.includes('descqdmp_') || kl.includes('descqed_'),
  buildValue(r, flavorText) {
    const hasSnare = r['Snare Radius'] && r['Snare Radius'] !== '0';
    const itemType = hasSnare ? 'Quantum Enforcement Device' : 'Quantum Dampener';

    let val =
      `Item Type: ${itemType}` +
      `\\nManufacturer: ${r['Manufacturer']}` +
      `\\nSize: ${r['Size']}` +
      `\\n\\n-- QED Stats --` +
      `\\nJammer Range: ${fmtNum(r['Jammer Range'])}m`;

    if (hasSnare) {
      val += `\\nSnare Radius: ${fmtNum(r['Snare Radius'])}m`;
    }

    val +=
      `\\nPower Consumption: ${r['Power Consumption']}` +
      `\\nSnare Charge Time: ${r['Snare Charge Time']}s` +
      `\\nSnare Activation Time: ${r['Snare Activation Time']}s` +
      `\\nSnare Cooldown Time: ${r['Snare Cooldown Time']}s` +
      `\\nSnare Discharge Time: ${r['Snare Discharge Time']}s`;

    if (flavorText) val += `\\n\\n${flavorText}`;
    return val;
  },
};
