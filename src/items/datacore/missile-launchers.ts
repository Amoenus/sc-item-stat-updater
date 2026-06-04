import { stat } from '../../enrichment/stat-builder';
import type { ItemConfig } from '../../enrichment/item-config';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

// ⚠️ Verify p4kFilter, entityClassPrefix, nameKeyInfix and fieldSelectors
// against real unforged game files. Launchers may live under
// scitemweapon_missile_rack or scitemvehicle_missilelauncher.
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/missile_racks',
  // mssl_ksar_s2_panther → strip 'mssl_' → 'KSAR_S2_PANTHER' → item_NameMSSL_KSAR_S2_PANTHER
  entityClassPrefix: 'mssl_',
  nameKeyInfix: 'MRCK_',
  fieldSelectors: {
    'Missile Quantity': 'SMissileRackComponentParams MissileRackParams MaxMissiles',
    'Missile Size': 'SMissileRackComponentParams MissileRackParams MissileSize',
  },
};

export default {
  csvFile: 'missilelauncher.datacore.csv',
  label: 'DC Missile Launchers',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Missile Quantity', 'Missile Size', 'Health'],
  descKeyMatch: (kl) => kl.includes('descmrck_') || kl.includes('desc_mrck_'),
  getTargetKeys: makeGetTargetKeys('mssl_', 'MRCK_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Missile Launcher')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Carriage --')
      .raw('Missile Quantity', 'Missile Quantity')
      .raw('Missile Size', 'Missile Size')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
