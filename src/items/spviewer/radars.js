// @ts-check
import { stat } from '../../lib/format/stat-builder.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'spviewer/radar.spviewer.csv',
  label: 'SP Radars',
  nameColumn: 'Name',
  lookupCsvFile: 'erkul/radars.csv',
  requiredColumns: ['Name', 'Manufacturer', 'Size', 'Class', 'Grade', 'Health'],
  descKeyMatch: (kl) => kl.includes('desc_radr_') || kl.includes('descradr_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Radar')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Grade', 'Grade')
      .lineIf('Class', r['Class'])
      .section('-- Aim Assist (PiP) --')
      .rawIf('Min Distance', 'Aim Assist Distance (PiP) Min')
      .rawIf('Max Distance', 'Aim Assist Distance (PiP) Max')
      .rawIf('Buffer', 'Aim Assist Distance (PiP) Buffer')
      .section('-- Sensitivity --')
      .rawIf('IR', 'Sensitivity IR')
      .rawIf('CS', 'Sensitivity CS')
      .rawIf('EM', 'Sensitivity EM')
      .rawIf('RS', 'Sensitivity RS')
      .rawIf('dB', 'Sensitivity dB')
      .section('-- Piercing --')
      .rawIf('IR', 'Piercing IR')
      .rawIf('CS', 'Piercing CS')
      .rawIf('EM', 'Piercing EM')
      .section('-- Emission --')
      .rawIf('EM Max', 'EM Emit Max')
      .rawIf('IR', 'IR Emit')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .rawIf('Distortion Shutdown', 'Distortion Resistance Shutdown Dmg')
      .build(flavorText);
  },
};
