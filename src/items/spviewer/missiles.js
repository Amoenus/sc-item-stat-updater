// @ts-check
import { stat } from '../../lib/format/stat-builder.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'spviewer/missile.spviewer.csv',
  label: 'SP Missiles',
  nameColumn: 'Name',
  lookupCsvFile: 'erkul/missiles.csv',
  requiredColumns: [
    'Name',
    'Manufacturer',
    'Size',
    'Tracking Signal',
    'Damage Total',
    'Speed  m/s',
    'Delay Arm',
    'Delay Lock',
    'Target Lock Range',
    'Target Lock Angle',
    'Health',
  ],
  descKeyMatch: (kl) => kl.includes('descmisl_') || kl.includes('descgmisl_'),
  buildValue(r, flavorText) {
    const isTorpedo = parseInt(r['Size'], 10) >= 7;

    return stat(r)
      .line('Item Type', isTorpedo ? 'Torpedo' : 'Missile')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Tracking Signal', 'Tracking Signal')
      .rawIf('Rack Compatibility', 'Rack Compatibility')
      .section('-- Damage --')
      .raw('Total Damage', 'Damage Total')
      .rawIf('Physical', 'Damage Physical')
      .rawIf('Energy', 'Damage Energy')
      .rawIf('Distortion', 'Damage Distortion')
      .section('-- Flight --')
      .raw('Speed', 'Speed  m/s', ' m/s')
      .rawIf('Fuel Tank', 'Fuel  Tank')
      .rawIf('Flight Time', 'Flight Time')
      .rawIf('Flight Distance', 'Flight Distance')
      .section('-- Lock & Arm --')
      .raw('Arm Delay', 'Delay Arm')
      .raw('Lock Delay', 'Delay Lock')
      .raw('Lock Range', 'Target Lock Range')
      .raw('Lock Angle', 'Target Lock Angle')
      .rawIf('Lock Ratio Min', 'Target Lock Ratio Min.')
      .section('-- Explosion --')
      .rawIf('Safety Distance', 'Explosion Safety Distance')
      .rawIf('Proximity', 'Explosion Proximity')
      .rawIf('Radius', 'Explosion Radius')
      .raw('Health', 'Health')
      .build(flavorText);
  },
};
