// @ts-check
import { stat } from '../../lib/format/stat-builder.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'erkul/emps.csv',
  label: 'EMPs',
  requiredColumns: [
    'Localization Key',
    'Manufacturer',
    'Size',
    'Dmg',
    'EMP Radius Min',
    'EMP Radius Max',
    'Charge Time',
    'Unleash Time',
    'Cooldown',
    'Power Consumption',
    'Health',
    'Distortion Shutdown Dmg',
    'Distortion Decay Delay',
    'Distortion Decay Rate',
    'Distortion Warning Ratio',
  ],
  descKeyMatch: (kl) => kl.includes('desc') && kl.includes('emp'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'EMP Generator')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- EMP Stats --')
      .num('Damage', 'Dmg')
      .line('EMP Radius', `${r['EMP Radius Min']} - ${r['EMP Radius Max']}m`)
      .raw('Charge Time', 'Charge Time', 's')
      .raw('Unleash Time', 'Unleash Time', 's')
      .raw('Cooldown', 'Cooldown', 's')
      .section('-- Power --')
      .raw('Power Consumption', 'Power Consumption')
      .section('-- Durability --')
      .num('Health', 'Health')
      .num('Distortion Shutdown Dmg', 'Distortion Shutdown Dmg')
      .raw('Distortion Decay Delay', 'Distortion Decay Delay', 's')
      .raw('Distortion Decay Rate', 'Distortion Decay Rate')
      .raw('Distortion Warning Ratio', 'Distortion Warning Ratio')
      .build(flavorText);
  },
};
