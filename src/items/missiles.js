// @ts-check
import { fmtNum, stat } from '../lib/stat-builder.js';

/** @type {import('../lib/types.js').ItemConfig} */
export default {
  csvFile: 'missiles.csv',
  label: 'Missiles',
  requiredColumns: [
    'Localization Key',
    'Manufacturer',
    'Tracking Signal Type',
    'Size',
    'Dmg Total',
    'Dmg Physical',
    'Dmg Energy',
    'Dmg Distortion',
    'Cluster Count',
    'Speed',
    'Arm Time',
    'Lock Time',
    'Locking Angle',
    'Lock Range Min',
    'Lock Range Max',
    'Ignite Time',
    'Explosion Radius Min',
    'Explosion Radius Max',
    'Health',
  ],
  descKeyMatch: (kl) => kl.includes('descmisl_') || kl.includes('descgmisl_'),
  buildValue(r, flavorText) {
    const isTorpedo = parseInt(r['Size'], 10) >= 7;

    return stat(r)
      .line('Item Type', isTorpedo ? 'Torpedo' : 'Missile')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Tracking Signal', 'Tracking Signal Type')
      .raw('Size', 'Size')
      .section('-- Damage --')
      .num('Total Damage', 'Dmg Total')
      .numIf('Physical', 'Dmg Physical')
      .numIf('Energy', 'Dmg Energy')
      .numIf('Distortion', 'Dmg Distortion')
      .rawIf('Cluster Count', 'Cluster Count')
      .section('-- Flight Stats --')
      .num('Speed', 'Speed', ' m/s')
      .raw('Arm Time', 'Arm Time', 's')
      .raw('Lock Time', 'Lock Time', 's')
      .raw('Locking Angle', 'Locking Angle', '°')
      .line('Lock Range', `${fmtNum(r['Lock Range Min'])} - ${fmtNum(r['Lock Range Max'])}m`)
      .raw('Ignite Time', 'Ignite Time', 's')
      .section('-- Explosion --')
      .line('Radius', `${r['Explosion Radius Min']} - ${r['Explosion Radius Max']}m`)
      .num('Health', 'Health')
      .build(flavorText);
  },
};
