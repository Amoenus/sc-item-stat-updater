import { stat } from '../../enrichment/stat-builder';
import type { ItemConfig } from '../../enrichment/item-config';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

// ⚠️ Verify p4kFilter, entityClassPrefix, nameKeyInfix and fieldSelectors
// against real unforged game files. Turret entity classes and component
// names are inferred from community data.
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/turret',
  // turr_orig_s3_m4a → strip 'turr_' → 'ORIG_S3_M4A' → item_NameTURR_ORIG_S3_M4A
  entityClassPrefix: 'turr_',
  nameKeyInfix: 'TURR_',
  fieldSelectors: {
    'Yaw Speed': 'STurretComponentParams TurretParams yawSpeed',
    'Pitch Speed': 'STurretComponentParams TurretParams pitchSpeed',
    'Yaw Accel': 'STurretComponentParams TurretParams yawAcceleration',
    'Pitch Accel': 'STurretComponentParams TurretParams pitchAcceleration',
  },
};

export default {
  csvFile: 'turret.datacore.csv',
  label: 'DC Turrets',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Health'],
  descKeyMatch: (kl) => kl.includes('desc') && kl.includes('turret'),
  getTargetKeys: makeGetTargetKeys('turr_', 'TURR_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Turret')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Rotation --')
      .rawIf('Yaw Speed', 'Yaw Speed')
      .rawIf('Pitch Speed', 'Pitch Speed')
      .rawIf('Yaw Accel', 'Yaw Accel')
      .rawIf('Pitch Accel', 'Pitch Accel')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
