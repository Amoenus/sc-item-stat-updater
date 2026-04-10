// @ts-check
import { stat } from '../lib/stat-builder.js';

/** @type {import('../lib/types.js').ItemConfig} */
export default {
  csvFile: 'qeds.csv',
  label: 'QEDs',
  requiredColumns: [
    'Localization Key',
    'Manufacturer',
    'Size',
    'Jammer Range',
    'Snare Radius',
    'Power Consumption',
    'Snare Charge Time',
    'Snare Activation Time',
    'Snare Cooldown Time',
    'Snare Discharge Time',
  ],
  descKeyMatch: (kl) => kl.includes('descqdmp_') || kl.includes('descqed_'),
  buildValue(r, flavorText) {
    const hasSnare = r['Snare Radius'] && r['Snare Radius'] !== '0';

    const s = stat(r)
      .line('Item Type', hasSnare ? 'Quantum Enforcement Device' : 'Quantum Dampener')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- QED Stats --')
      .num('Jammer Range', 'Jammer Range', 'm');

    if (hasSnare) {
      s.num('Snare Radius', 'Snare Radius', 'm');
    }

    return s
      .raw('Power Consumption', 'Power Consumption')
      .raw('Snare Charge Time', 'Snare Charge Time', 's')
      .raw('Snare Activation Time', 'Snare Activation Time', 's')
      .raw('Snare Cooldown Time', 'Snare Cooldown Time', 's')
      .raw('Snare Discharge Time', 'Snare Discharge Time', 's')
      .build(flavorText);
  },
};
