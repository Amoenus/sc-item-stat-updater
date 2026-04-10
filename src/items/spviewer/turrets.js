// @ts-check
import { stat } from '../../lib/format/stat-builder.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'spviewer/turret.spviewer.csv',
  label: 'SP Turrets',
  nameColumn: 'Name',
  requiredColumns: ['Name', 'Manufacturer', 'Size', 'Health'],
  descKeyMatch: (kl) => kl.includes('desc') && kl.includes('turret'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Turret')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Yaw Axis --')
      .rawIf('Speed', 'Yaw Axis Speed')
      .rawIf('Time To Full Speed', 'Yaw Axis Time To Full Speed')
      .rawIf('Accel Decay', 'Yaw Axis Accel. Decay')
      .section('-- Pitch Axis --')
      .rawIf('Speed', 'Pitch Axis Speed')
      .rawIf('Time To Full Speed', 'Pitch Axis Time To Full Speed')
      .rawIf('Accel Decay', 'Pitch Axis Accel. Decay')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
};
