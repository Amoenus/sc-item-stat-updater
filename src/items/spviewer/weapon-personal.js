// @ts-check
import { stat } from '../../lib/format/stat-builder.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'spviewer/weaponpersonal.spviewer.csv',
  label: 'SP Personal Weapons',
  nameColumn: 'Name',
  requiredColumns: [
    'Name',
    'Manufacturer',
    'Size',
    'Type',
    'Fire Mode',
    'Damage DPS',
    'Damage Alpha',
    'Damage RPM',
    'Ammo Speed',
    'Ammo Range',
    'Ammo Quantity',
  ],
  descKeyMatch: (kl) =>
    (kl.includes('desc') &&
      (kl.includes('_pistol') ||
        kl.includes('_smg') ||
        kl.includes('_rifle') ||
        kl.includes('_sniper') ||
        kl.includes('_shotgun') ||
        kl.includes('_lmg'))) ||
    ((kl.includes('descgmni_') || kl.includes('descbehr_') || kl.includes('descklwe_') || kl.includes('descksar_')) &&
      !kl.includes('optics') &&
      !kl.includes('barrel')),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', r['Type'])
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Fire Mode', 'Fire Mode')
      .section('-- Damage --')
      .raw('DPS', 'Damage DPS')
      .raw('Alpha Damage', 'Damage Alpha')
      .rawIf('Max Per Mag', 'Damage Max. Per Mag')
      .raw('Rate of Fire', 'Damage RPM', ' RPM')
      .rawIf('Physical DPS', 'Damage DPS Physical')
      .rawIf('Energy DPS', 'Damage DPS Energy')
      .rawIf('Distortion DPS', 'Damage DPS Distortion')
      .rawIf('Stun DPS', 'Damage DPS Stun')
      .section('-- Ballistics --')
      .raw('Speed', 'Ammo Speed', ' m/s')
      .raw('Range', 'Ammo Range', 'm')
      .raw('Ammo', 'Ammo Quantity')
      .rawIf('Pellets Per Shot', 'Ammo Pellets Per Shot')
      .rawIf('Explosion Radius', 'Ammo Explosion Radius')
      .section('-- Spread --')
      .rawIf('Min', 'Spread Min')
      .rawIf('Max', 'Spread Max')
      .rawIf('First Attack', 'Spread First Attack')
      .rawIf('Per Attack', 'Spread Per Attack')
      .rawIf('Decay', 'Spread Decay')
      .build(flavorText);
  },
};
