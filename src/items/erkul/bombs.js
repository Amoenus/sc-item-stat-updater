// @ts-check
import { stat } from '../../lib/format/stat-builder.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'erkul/bombs.csv',
  label: 'Bombs',
  requiredColumns: [
    'Localization Key',
    'Manufacturer',
    'Size',
    'Dmg Total',
    'Dmg Energy',
    'Dmg Physical',
    'Dmg Distortion',
    'Dmg Biochemical',
    'Dmg Stun',
    'Dmg Thermal',
    'Arm Time',
    'Ignite Time',
    'Explosion Radius Min',
    'Explosion Radius Max',
    'Health',
  ],
  descKeyMatch: (kl) => kl.includes('descbomb_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Bomb')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Damage --')
      .num('Total Damage', 'Dmg Total')
      .numIf('Energy Damage', 'Dmg Energy')
      .numIf('Physical Damage', 'Dmg Physical')
      .numIf('Distortion Damage', 'Dmg Distortion')
      .numIf('Biochemical Damage', 'Dmg Biochemical')
      .numIf('Stun Damage', 'Dmg Stun')
      .numIf('Thermal Damage', 'Dmg Thermal')
      .section('-- Stats --')
      .raw('Arm Time', 'Arm Time', 's')
      .raw('Ignite Time', 'Ignite Time', 's')
      .line('Explosion Radius', `${r['Explosion Radius Min']} - ${r['Explosion Radius Max']}m`)
      .num('Health', 'Health')
      .build(flavorText);
  },
};
