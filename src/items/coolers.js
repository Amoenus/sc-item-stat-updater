// @ts-check
import { stat } from '../lib/stat-builder.js';

/** @type {import('../lib/types.js').ItemConfig} */
export default {
  csvFile: 'coolers.csv',
  label: 'Coolers',
  requiredColumns: [
    'Localization Key',
    'Manufacturer',
    'Size',
    'Grade',
    'Class',
    'Cooling Generation',
    'Power Consumption',
    'EM Max',
    'IR Max',
    'Health',
    'Distortion Shutdown Dmg',
    'Distortion Decay Delay',
    'Distortion Decay Rate',
    'Distortion Warning Ratio',
  ],
  descKeyMatch: (kl) => kl.includes('desccool_') || kl.includes('desc_cool_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Cooler')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Grade', 'Grade')
      .lineIf('Class', r['Class'])
      .section('-- Cooling Stats --')
      .num('Cooling Generation', 'Cooling Generation')
      .section('-- Power & Emission --')
      .raw('Power Consumption', 'Power Consumption')
      .num('EM Max', 'EM Max')
      .num('IR Max', 'IR Max')
      .section('-- Durability & Distortion --')
      .num('Health', 'Health')
      .num('Distortion Shutdown Dmg', 'Distortion Shutdown Dmg')
      .raw('Distortion Decay Delay', 'Distortion Decay Delay', 's')
      .raw('Distortion Decay Rate', 'Distortion Decay Rate')
      .raw('Distortion Warning Ratio', 'Distortion Warning Ratio')
      .build(flavorText);
  },
};
