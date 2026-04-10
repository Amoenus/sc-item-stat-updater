// @ts-check
import { stat } from '../lib/stat-builder.js';

/** @type {import('../lib/types.js').ItemConfig} */
export default {
  csvFile: 'tractor_beams.csv',
  label: 'Tractor Beams',
  requiredColumns: [
    'Localization Key',
    'Manufacturer',
    'Size',
    'Max Force',
    'Min Force',
    'Max Distance',
    'Min Distance',
    'Full Strength Distance',
    'Max Angle',
    'Power Consumption',
    'Health',
  ],
  descKeyMatch: (kl) => kl.includes('desc') && kl.includes('tractorbeam'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Tractor Beam')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Tractor Beam Stats --')
      .num('Max Force', 'Max Force', 'N')
      .raw('Min Force', 'Min Force', 'N')
      .raw('Max Distance', 'Max Distance', 'm')
      .raw('Min Distance', 'Min Distance', 'm')
      .raw('Full Strength Distance', 'Full Strength Distance', 'm')
      .raw('Max Angle', 'Max Angle', '°')
      .section('-- Power & Durability --')
      .raw('Power Consumption', 'Power Consumption')
      .num('Health', 'Health')
      .build(flavorText);
  },
};
