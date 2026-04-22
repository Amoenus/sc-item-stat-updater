// @ts-check
import { stat } from '../../lib/format/stat-builder.js';
import { buildComponentDisplayName } from '../../lib/format/component-name-prefix.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'spviewer/powerplant.spviewer.csv',
  label: 'SP Power Plants',
  nameColumn: 'Name',
  lookupCsvFile: 'erkul/powerplants.csv',
  buildName(r, lookupRows) {
    return buildComponentDisplayName(r, lookupRows);
  },
  requiredColumns: ['Name', 'Manufacturer', 'Size', 'Class', 'Grade', 'SegmentGeneration', 'Health'],
  descKeyMatch: (kl) => kl.includes('descpowr_') || kl.includes('desc_powr_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Power Plant')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Grade', 'Grade')
      .lineIf('Class', r['Class'])
      .section('-- Power Stats --')
      .raw('Segment Generation', 'SegmentGeneration')
      .section('-- Emission --')
      .rawIf('EM Per Segment', 'EM Emit Per Segment')
      .rawIf('EM All Segments', 'EM Emit All Segments')
      .rawIf('EM Decay', 'EM Emit Decay')
      .rawIf('IR', 'IR Emit')
      .section('-- Thermal --')
      .rawIf('Cooling Usage Start', 'Cooling Usage Start')
      .rawIf('Cooling Usage Min', 'Cooling Usage Min')
      .rawIf('Max Temp', 'Temperature (°C) Max')
      .rawIf('Overheat', 'Temperature (°C) Overheat')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .rawIf('Distortion Shutdown', 'Distortion Resistance Shutdown Dmg')
      .build(flavorText);
  },
};
