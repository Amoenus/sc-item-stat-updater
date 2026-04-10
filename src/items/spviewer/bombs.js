// @ts-check
import { stat } from '../../lib/format/stat-builder.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'spviewer/bomb.spviewer.csv',
  label: 'SP Bombs',
  nameColumn: 'Name',
  lookupCsvFile: 'erkul/bombs.csv',
  requiredColumns: [
    'Name',
    'Manufacturer',
    'Size',
    'Damage Total',
    'Delay Arm',
    'Delay Ignite',
    'Explosion Radius',
    'Health',
  ],
  descKeyMatch: (kl) => kl.includes('descbomb_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Bomb')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Damage --')
      .raw('Total Damage', 'Damage Total')
      .rawIf('Physical', 'Damage Physical')
      .rawIf('Energy', 'Damage Energy')
      .rawIf('Distortion', 'Damage Distortion')
      .section('-- Stats --')
      .raw('Arm Delay', 'Delay Arm')
      .raw('Ignite Delay', 'Delay Ignite')
      .rawIf('Proximity', 'Explosion Proximity')
      .raw('Explosion Radius', 'Explosion Radius')
      .raw('Health', 'Health')
      .build(flavorText);
  },
};
