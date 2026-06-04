import { stat } from '../../enrichment/stat-builder';
import type { ItemConfig } from '../../lib/types';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

// ⚠️ Verify p4kFilter, entityClassPrefix, nameKeyInfix and fieldSelectors
// against real unforged game files. The radar component type name and field
// names (sensitivity, piercing) are inferred from community data.
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/radar',
  // rdar_orig_s1_scan → strip 'rdar_' → 'ORIG_S1_SCAN' → item_NameRDAR_ORIG_S1_SCAN
  entityClassPrefix: 'rdar_',
  nameKeyInfix: 'RADR_',
  fieldSelectors: {
    'Sensitivity IR': 'SRadarComponentParams RadarParams SensitivityIR',
    'Sensitivity CS': 'SRadarComponentParams RadarParams SensitivityCS',
    'Sensitivity EM': 'SRadarComponentParams RadarParams SensitivityEM',
    'Sensitivity RS': 'SRadarComponentParams RadarParams SensitivityRS',
    'Sensitivity dB': 'SRadarComponentParams RadarParams SensitivitydB',
    'Piercing IR': 'SRadarComponentParams RadarParams PiercingIR',
    'Piercing CS': 'SRadarComponentParams RadarParams PiercingCS',
    'Piercing EM': 'SRadarComponentParams RadarParams PiercingEM',
  },
};

export default {
  csvFile: 'radar.datacore.csv',
  label: 'DC Radars',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Grade', 'Health'],
  descKeyMatch: (kl) => kl.includes('desc_radr_') || kl.includes('descradr_'),
  getTargetKeys: makeGetTargetKeys('rdar_', 'RADR_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Radar')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Grade', 'Grade')
      .lineIf('Class', r['Class'])
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
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
