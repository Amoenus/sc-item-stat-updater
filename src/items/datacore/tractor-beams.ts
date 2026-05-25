import { stat } from '../../lib/format/stat-builder';
import type { ItemConfig } from '../../lib/types';
import { makeGetTargetKeys, type DataCoreItemTypeConfig } from './types';

// ⚠️ Tractor beam entity class prefix and DataForge component names are
// inferred from community data. Verify against real game files.
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/utility/tractorbeam',
  // trctr_grin_s1_grapplerS → strip 'trctr_' → 'GRIN_S1_GRAPPLERS'
  entityClassPrefix: 'trctr_',
  nameKeyInfix: 'TRCTR_',
  fieldSelectors: {
    'Force': 'STractorBeamComponentParams TractorBeamParams MaxForce',
    'Range': 'STractorBeamComponentParams TractorBeamParams MaxRange',
    'Full Strength Distance': 'STractorBeamComponentParams TractorBeamParams FullStrengthDistance',
    'Max Angle': 'STractorBeamComponentParams TractorBeamParams MaxAngle',
    'Max Volume': 'STractorBeamComponentParams TractorBeamParams MaxVolume',
    'Tow Force': 'STractorBeamComponentParams TractorBeamParams TowingMaxForce',
    'Tow Max Distance': 'STractorBeamComponentParams TractorBeamParams TowingMaxDistance',
  },
};

export default {
  csvFile: 'tractorbeam.datacore.csv',
  label: 'DC Tractor Beams',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Force', 'Range', 'Health'],
  descKeyMatch: (kl) => kl.includes('desc') && kl.includes('tractorbeam'),
  getTargetKeys: makeGetTargetKeys('trctr_', 'TRCTR_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Tractor Beam')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Tractor Stats --')
      .raw('Force', 'Force', ' MN')
      .raw('Range', 'Range')
      .rawIf('Full Strength Distance', 'Full Strength Distance')
      .rawIf('Max Angle', 'Max Angle')
      .rawIf('Max Volume', 'Max Volume')
      .section('-- Towing --')
      .rawIf('Tow Force', 'Tow Force', ' MN')
      .rawIf('Tow Max Distance', 'Tow Max Distance')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
