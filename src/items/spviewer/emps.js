// @ts-check
import { stat } from '../../lib/format/stat-builder.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'spviewer/emp.spviewer.csv',
  label: 'SP EMPs',
  nameColumn: 'Name',
  lookupCsvFile: 'erkul/emps.csv',
  requiredColumns: [
    'Name',
    'Manufacturer',
    'Size',
    'Damage Total',
    'Damage Radius',
    'Delay Charge',
    'Delay Unleash',
    'Cooldown',
    'Health',
  ],
  descKeyMatch: (kl) => kl.includes('desc') && kl.includes('emp'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'EMP Generator')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- EMP Stats --')
      .raw('Damage', 'Damage Total')
      .raw('Radius', 'Damage Radius')
      .raw('Charge Delay', 'Delay Charge')
      .raw('Unleash Delay', 'Delay Unleash')
      .raw('Cooldown', 'Cooldown')
      .section('-- Emission --')
      .rawIf('EM Active', 'EM Emit Active')
      .rawIf('IR', 'IR Emit')
      .section('-- Power --')
      .rawIf('Power Start', 'Power Segment Usage Start')
      .rawIf('Power Min', 'Power Segment Usage Min')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .rawIf('Distortion Shutdown', 'Distortion Resistance Shutdown Dmg')
      .build(flavorText);
  },
};
