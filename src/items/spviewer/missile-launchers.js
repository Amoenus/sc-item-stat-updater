// @ts-check
import { stat } from '../../lib/format/stat-builder.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'spviewer/missilelauncher.spviewer.csv',
  label: 'SP Missile Launchers',
  nameColumn: 'Name',
  requiredColumns: ['Name', 'Manufacturer', 'Size', 'Missile carriage Quantity', 'Missile carriage Size', 'Health'],
  descKeyMatch: (kl) => kl.includes('descmrck_') || kl.includes('desc_mrck_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Missile Launcher')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Carriage --')
      .raw('Missile Quantity', 'Missile carriage Quantity')
      .raw('Missile Size', 'Missile carriage Size')
      .rawIf('Item', 'Item')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .rawIf('Self Repair', 'Self Repair Use')
      .rawIf('Repair Time', 'Self Repair Time to Repair')
      .build(flavorText);
  },
};
