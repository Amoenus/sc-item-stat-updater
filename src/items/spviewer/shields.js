// @ts-check
import { stat } from '../../lib/format/stat-builder.js';
import { buildComponentDisplayName } from '../../lib/format/component-name-prefix.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'spviewer/shield.spviewer.csv',
  label: 'SP Shields',
  nameColumn: 'Name',
  lookupCsvFile: 'erkul/shields.csv',
  buildName(r, lookupRows) {
    return buildComponentDisplayName(r, lookupRows);
  },
  requiredColumns: [
    'Name',
    'Manufacturer',
    'Size',
    'Class',
    'Grade',
    'Shield Characteristics HP Pool',
    'Shield Characteristics Regen Rate',
    'Shield Characteristics Regen Time',
    'Shield Characteristics Damaged Delay',
    'Shield Characteristics Downed Delay',
    'Health',
  ],
  descKeyMatch: (kl) => kl.includes('descshld_') || kl.includes('desc_shld_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Shield Generator')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Grade', 'Grade')
      .lineIf('Class', r['Class'])
      .section('-- Shield Stats --')
      .raw('Pool HP', 'Shield Characteristics HP Pool')
      .raw('Regen Rate', 'Shield Characteristics Regen Rate')
      .raw('Regen Time', 'Shield Characteristics Regen Time')
      .raw('Damaged Delay', 'Shield Characteristics Damaged Delay')
      .raw('Downed Delay', 'Shield Characteristics Downed Delay')
      .section('-- NAV-SCM Reserve --')
      .rawIf('Reserve Regen Rate', 'NAV-SCM Reserve Pool Regen Rate')
      .rawIf('Reserve Regen Time', 'NAV-SCM Reserve Pool Regen Time')
      .section('-- Resistances (Max / Min) --')
      .rawIf('Physical', 'Resistance (Max / Min) Physical')
      .rawIf('Energy', 'Resistance (Max / Min) Energy')
      .rawIf('Distortion', 'Resistance (Max / Min) Distortion')
      .section('-- Absorption (Max / Min) --')
      .rawIf('Physical', 'Absorption (Max / Min) Physical')
      .rawIf('Energy', 'Absorption (Max / Min) Energy')
      .rawIf('Distortion', 'Absorption (Max / Min) Distortion')
      .section('-- Emission --')
      .rawIf('EM Min', 'EM Emit Min')
      .rawIf('EM Max', 'EM Emit Max')
      .rawIf('IR', 'IR Emit')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .rawIf('Distortion Shutdown', 'Distortion Resistance Shutdown Dmg')
      .build(flavorText);
  },
};
