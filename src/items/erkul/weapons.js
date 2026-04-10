// @ts-check
import { stat } from '../../lib/format/stat-builder.js';
import { isWeaponDescKey } from '../shared/weapon-matchers.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'erkul/weapons.csv',
  label: 'Weapons',
  requiredColumns: [
    'Localization Key',
    'Type',
    'Manufacturer',
    'Size',
    'Alpha Damage',
    'DPS Single',
    'DPS Burst',
    'RPM',
    'Speed',
    'Range',
    'Ammo Count',
    'Max Ammo',
    'Ammo Per Shot',
    'Power Base',
    'EM',
    'Health',
    'Distortion Shutdown Dmg',
    'Distortion Warning Ratio',
  ],
  descKeyMatch: isWeaponDescKey,
  buildValue(r, flavorText) {
    const hasAmmo = r['Ammo Count'] && r['Ammo Count'] !== '0' && r['Ammo Count'] !== '' && r['Max Ammo'] !== '∞';

    const s = stat(r)
      .line('Item Type', r['Type'])
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Combat Stats --')
      .num('Alpha Damage', 'Alpha Damage')
      .num('DPS (Single)', 'DPS Single')
      .num('DPS (Burst)', 'DPS Burst')
      .num('Rate of Fire', 'RPM', ' RPM')
      .num('Projectile Speed', 'Speed', ' m/s')
      .num('Range', 'Range', 'm');

    if (hasAmmo) {
      s.section('-- Ammo --').num('Ammo Count', 'Ammo Count').num('Max Ammo', 'Max Ammo');
      if (r['Ammo Per Shot'] && r['Ammo Per Shot'] !== '∞') {
        s.num('Ammo Per Shot', 'Ammo Per Shot');
      }
    }

    return s
      .section('-- Power & Emission --')
      .raw('Power Base', 'Power Base')
      .num('EM', 'EM')
      .section('-- Durability --')
      .num('Health', 'Health')
      .num('Distortion Shutdown Dmg', 'Distortion Shutdown Dmg')
      .raw('Distortion Warning Ratio', 'Distortion Warning Ratio')
      .build(flavorText);
  },
};
