// @ts-check
import { stat } from '../../lib/format/stat-builder.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'spviewer/weaponattachment.spviewer.csv',
  label: 'SP Weapon Attachments',
  nameColumn: 'Name',
  requiredColumns: ['Name', 'Manufacturer', 'Size', 'Slot', 'Type'],
  descKeyMatch: (kl) =>
    kl.includes('desc') &&
    (kl.includes('barrel') || kl.includes('scope') || kl.includes('attachment') || kl.includes('optics')),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', r['Type'] || 'Weapon Attachment')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Slot', 'Slot')
      .section('-- Weapon Modifiers --')
      .rawIf('Damage', 'Weapon Modifier Damage')
      .rawIf('Projectile Speed', 'Weapon Modifier Projectile Speed')
      .rawIf('Ammo Cost', 'Weapon Modifier Ammo Cost')
      .rawIf('Sound Radius', 'Weapon Modifier Sound Radius')
      .rawIf('Muzzle Flash', 'Weapon Modifier Muzzle flash')
      .rawIf('Heat Generation', 'Weapon Modifier Heat Generation')
      .section('-- Recoil Modifiers --')
      .rawIf('Recoil', 'Recoil Modifier Recoil')
      .rawIf('Decay', 'Recoil Modifier Decay')
      .section('-- ADS --')
      .rawIf('Magnification 1', 'ADS Modifier Magnification 1')
      .rawIf('Magnification 2', 'ADS Modifier Magnification 2')
      .rawIf('Aim Time', 'ADS Modifier Aim Time')
      .build(flavorText);
  },
};
