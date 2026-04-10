// @ts-check
import { stat } from '../../lib/format/stat-builder.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'spviewer/cooler.spviewer.csv',
  label: 'SP Coolers',
  nameColumn: 'Name',
  lookupCsvFile: 'erkul/coolers.csv',
  requiredColumns: ['Name', 'Manufacturer', 'Size', 'Class', 'Grade', 'CoolingGeneration', 'Health'],
  descKeyMatch: (kl) => kl.includes('desccool_') || kl.includes('desc_cool_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Cooler')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Grade', 'Grade')
      .lineIf('Class', r['Class'])
      .section('-- Cooling Stats --')
      .raw('Cooling Generation', 'CoolingGeneration')
      .section('-- Emission --')
      .rawIf('EM Max', 'EM Emit Max')
      .rawIf('EM Decay', 'EM Emit Decay')
      .rawIf('IR', 'IR Emit')
      .section('-- Power --')
      .rawIf('Power Max', 'Power Segment Usage Max')
      .rawIf('Power Min', 'Power Segment Usage Min')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .rawIf('Distortion Shutdown', 'Distortion Resistance Shutdown Dmg')
      .build(flavorText);
  },
};
