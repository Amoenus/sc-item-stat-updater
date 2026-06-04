import { stat } from '../../enrichment/stat-builder';
import type { ItemConfig } from '../../lib/types';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

// ⚠️ Verify p4kFilter, entityClassPrefix, nameKeyInfix and fieldSelectors
// against real unforged game files.
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/powerplant',
  // powr_amrs_s1_heartbeat → strip 'powr_' → 'AMRS_S1_HEARTBEAT' → item_NamePOWR_AMRS_S1_HEARTBEAT
  entityClassPrefix: 'powr_',
  nameKeyInfix: 'POWR_',
  fieldSelectors: {
    'Power Output': 'SPowerPlantComponentParams PowerPlantParams PowerOutput',
    'EM Per Segment': 'SPowerPlantComponentParams PowerPlantParams ElectromagneticEmissionPerPowerSegment',
  },
};

export default {
  csvFile: 'powerplant.datacore.csv',
  label: 'DC Power Plants',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Grade', 'Power Output', 'Health'],
  descKeyMatch: (kl) => kl.includes('descpowr_') || kl.includes('desc_powr_'),
  getTargetKeys: makeGetTargetKeys('powr_', 'POWR_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Power Plant')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Grade', 'Grade')
      .lineIf('Class', r['Class'])
      .section('-- Power Stats --')
      .raw('Power Output', 'Power Output')
      .section('-- Emission --')
      .rawIf('EM Per Segment', 'EM Per Segment')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
