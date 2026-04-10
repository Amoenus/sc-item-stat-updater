// @ts-check
import { stat } from '../../lib/format/stat-builder.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'erkul/radars.csv',
  label: 'Radars',
  requiredColumns: [
    'Localization Key',
    'Manufacturer',
    'Size',
    'Grade',
    'Class',
    'Aim Assist Max Dist',
    'Aim Assist Min Dist',
    'Outside Range Buffer',
    'CS Sensitivity',
    'EM Sensitivity',
    'IR Sensitivity',
    'Power Consumption',
    'EM Max',
    'Health',
    'Distortion Shutdown Dmg',
    'Distortion Decay Delay',
    'Distortion Decay Rate',
    'Distortion Warning Ratio',
  ],
  descKeyMatch: (kl) => kl.includes('desc_radr_') || kl.includes('descradr_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Radar')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Grade', 'Grade')
      .lineIf('Class', r['Class'])
      .section('-- Detection --')
      .num('Max Detection Range', 'Aim Assist Max Dist', 'm')
      .num('Min Detection Range', 'Aim Assist Min Dist', 'm')
      .raw('Outside Range Buffer', 'Outside Range Buffer', 'm')
      .section('-- Sensitivity --')
      .raw('Cross Section', 'CS Sensitivity')
      .raw('Electromagnetic', 'EM Sensitivity')
      .raw('Infrared', 'IR Sensitivity')
      .section('-- Power & Emission --')
      .raw('Power Consumption', 'Power Consumption')
      .num('EM Max', 'EM Max')
      .section('-- Durability & Distortion --')
      .num('Health', 'Health')
      .num('Distortion Shutdown Dmg', 'Distortion Shutdown Dmg')
      .raw('Distortion Decay Delay', 'Distortion Decay Delay', 's')
      .raw('Distortion Decay Rate', 'Distortion Decay Rate')
      .raw('Distortion Warning Ratio', 'Distortion Warning Ratio')
      .build(flavorText);
  },
};
