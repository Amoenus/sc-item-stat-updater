// @ts-check
import { stat } from '../../lib/format/stat-builder.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'spviewer/weapondefensive.spviewer.csv',
  label: 'SP Defensive Weapons',
  nameColumn: 'Name',
  requiredColumns: ['Name', 'Manufacturer', 'Size', 'Type', 'Health'],
  descKeyMatch: (kl) =>
    kl.includes('desc') &&
    (kl.includes('chaff') || kl.includes('flare') || kl.includes('noise') || kl.includes('countermeasure')),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', r['Type'] || 'Defensive Weapon')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Ammo --')
      .rawIf('Quantity', 'Ammo Quantity')
      .rawIf('Speed', 'Ammo Speed')
      .rawIf('Range', 'Ammo Range')
      .rawIf('Lifetime', 'Ammo Lifetime')
      .section('-- Signatures --')
      .rawIf('IR', 'Ammo Signature IR')
      .rawIf('CS', 'Ammo Signature CS')
      .rawIf('EM', 'Ammo Signature EM')
      .rawIf('dB', 'Ammo Signature dB')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
};
