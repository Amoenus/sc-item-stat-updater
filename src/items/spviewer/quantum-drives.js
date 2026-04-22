// @ts-check
import { stat } from '../../lib/format/stat-builder.js';
import { buildComponentDisplayName } from '../../lib/format/component-name-prefix.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'spviewer/quantumdrive.spviewer.csv',
  label: 'SP Quantum Drives',
  nameColumn: 'Name',
  lookupCsvFile: 'erkul/quantum_drives.csv',
  buildName(r, lookupRows) {
    return buildComponentDisplayName(r, lookupRows);
  },
  requiredColumns: ['Name', 'Manufacturer', 'Size', 'Speed Maximum', 'Delay Spool', 'Delay Cooldown', 'Health'],
  descKeyMatch: (kl) => kl.includes('descqdrv_') || kl.includes('desc_qdrv_') || kl.includes('desc_qrdv_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Quantum Drive')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Drive Stats --')
      .raw('Max Speed', 'Speed Maximum')
      .rawIf('Stage 1 Accel', 'Speed Stage 1 Accel.')
      .rawIf('Stage 2 Accel', 'Speed Stage 2 Accel.')
      .rawIf('Spline Speed', 'Speed Spline')
      .raw('Spool Delay', 'Delay Spool')
      .raw('Cooldown', 'Delay Cooldown')
      .rawIf('Interdiction Delay', 'Delay Interdiction')
      .section('-- Fuel Consumption --')
      .rawIf('Per GM', 'Consumption (SCU) Per GM')
      .rawIf('Efficiency', 'Consumption (SCU) Efficiency')
      .section('-- Travel Times --')
      .rawIf('10 GM', 'Travel Time 10 GM')
      .rawIf('Crusader - MT', 'Travel Time Crusader - MT')
      .rawIf('Terminus - Pyro V', 'Travel Time Terminus - Pyro V')
      .section('-- Fuel Required --')
      .rawIf('10 GM', 'Required Fuel (SCU) 10 GM')
      .rawIf('Crusader - MT', 'Required Fuel (SCU) Crusader - MT')
      .rawIf('Terminus - Pyro V', 'Required Fuel (SCU) Terminus - Pyro V')
      .section('-- Emission --')
      .rawIf('EM Active', 'EM Emit Active')
      .rawIf('IR', 'IR Emit')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .rawIf('Distortion Shutdown', 'Distortion Resistance Shutdown Dmg')
      .build(flavorText);
  },
};
