// @ts-check
import { stat } from '../../lib/format/stat-builder.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'spviewer/throwable.spviewer.csv',
  label: 'SP Throwables',
  nameColumn: 'Name',
  requiredColumns: ['Name', 'Manufacturer', 'Size', 'Type'],
  descKeyMatch: (kl) => kl.includes('desc') && (kl.includes('grenade') || kl.includes('throwable')),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', r['Type'] || 'Throwable')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Damage --')
      .rawIf('Physical', 'Damage Physical')
      .rawIf('Energy', 'Damage Energy')
      .rawIf('Distortion', 'Damage Distortion')
      .section('-- Explosion --')
      .rawIf('Detonation Delay', 'Explosion Detonation Delay')
      .rawIf('Radius', 'Explosion Radius')
      .rawIf('Pressure', 'Explosion Pressure')
      .build(flavorText);
  },
};
