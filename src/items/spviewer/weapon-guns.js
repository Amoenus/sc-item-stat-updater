// @ts-check
import { stat } from '../../lib/format/stat-builder.js';
import { isWeaponDescKey } from '../shared/weapon-matchers.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'spviewer/weapongun.spviewer.csv',
  label: 'SP Weapon Guns',
  nameColumn: 'Name',
  lookupCsvFile: 'erkul/weapons.csv',
  requiredColumns: [
    'Name',
    'Manufacturer',
    'Size',
    'Type',
    'Damage Alpha',
    'Damage Sustained (60s)',
    'Damage Burst',
    'Damage RPM',
    'Ammo Speed',
    'Ammo Range',
    'Ammo Quantity',
    'Health',
  ],
  descKeyMatch: isWeaponDescKey,
  buildValue(r, flavorText) {
    const hasAmmo =
      r['Ammo Quantity'] && r['Ammo Quantity'] !== '0' && r['Ammo Quantity'] !== '' && r['Ammo Quantity'] !== '∞';

    const s = stat(r)
      .line('Item Type', r['Type'])
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Combat Stats --')
      .raw('Alpha Damage', 'Damage Alpha')
      .raw('DPS (Sustained 60s)', 'Damage Sustained (60s)')
      .raw('DPS (Burst)', 'Damage Burst')
      .raw('Rate of Fire', 'Damage RPM', ' RPM')
      .raw('Projectile Speed', 'Ammo Speed', ' m/s')
      .raw('Range', 'Ammo Range', 'm');

    if (hasAmmo) {
      s.section('-- Ammo --').raw('Ammo Count', 'Ammo Quantity');
    }

    s.section('-- Heat & Capacitor --');
    if (r['Heat Per Shot'] && r['Heat Per Shot'] !== '0') s.raw('Heat Per Shot', 'Heat Per Shot');
    if (r['Overheat Max Round'] && r['Overheat Max Round'] !== '0') s.raw('Overheat Max Rounds', 'Overheat Max Round');
    if (r['Overheat Max Time'] && r['Overheat Max Time'] !== '0') s.raw('Overheat Max Time', 'Overheat Max Time', 's');

    return s
      .section('-- Durability --')
      .raw('Health', 'Health')
      .rawIf('Distortion Shutdown', 'Distortion Resistance Shutdown Dmg')
      .build(flavorText);
  },
};
