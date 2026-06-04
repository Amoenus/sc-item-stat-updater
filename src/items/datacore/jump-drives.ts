import { stat } from '../../enrichment/stat-builder';
import type { ItemConfig } from '../../enrichment/item-config';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

// ⚠️ Verify p4kFilter, entityClassPrefix, nameKeyInfix and fieldSelectors
// against real unforged game files. Jump drives are rare and the DataForge
// component type name may differ from the QD format.
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/jumpdrive',
  // jdrv_orig_s3_holvn → strip 'jdrv_' → 'ORIG_S3_HOLVN' → item_NameJDRV_ORIG_S3_HOLVN
  entityClassPrefix: 'jdrv_',
  nameKeyInfix: 'JDRV_',
  fieldSelectors: {
    'Alignment Rate': 'SJumpDriveComponentParams JumpDriveParams AlignmentRate',
    'Alignment Decay': 'SJumpDriveComponentParams JumpDriveParams AlignmentDecayRate',
    'Tuning Rate': 'SJumpDriveComponentParams JumpDriveParams TuningRate',
    'Tuning Decay': 'SJumpDriveComponentParams JumpDriveParams TuningDecayRate',
    'Fuel Usage Mult': 'SJumpDriveComponentParams JumpDriveParams FuelUsageMultiplier',
  },
};

export default {
  csvFile: 'jumpdrive.datacore.csv',
  label: 'DC Jump Drives',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Grade', 'Health'],
  descKeyMatch: (kl) => kl.includes('desc') && kl.includes('jdrv'),
  getTargetKeys: makeGetTargetKeys('jdrv_', 'JDRV_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Jump Drive')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Grade', 'Grade')
      .lineIf('Class', r['Class'])
      .section('-- Jump Drive Stats --')
      .rawIf('Alignment Rate', 'Alignment Rate')
      .rawIf('Alignment Decay', 'Alignment Decay')
      .rawIf('Tuning Rate', 'Tuning Rate')
      .rawIf('Tuning Decay', 'Tuning Decay')
      .rawIf('Fuel Usage Mult', 'Fuel Usage Mult')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
