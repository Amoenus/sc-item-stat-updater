import { stat } from '../../enrichment/stat-builder';
import type { ItemConfig } from '../../enrichment/item-config';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

// ⚠️ Self-destruct entity class prefix and DataForge component names are
// speculative. Verify against real game files.
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/selfdestruct',
  // sdsys_orig_s3 → strip 'sdsys_' → 'ORIG_S3'
  entityClassPrefix: 'sdsys_',
  nameKeyInfix: 'SDSYS_',
  fieldSelectors: {
    Countdown: 'SSelfDestructComponentParams SelfDestructParams Countdown',
    'Explosion Damage': 'SSelfDestructComponentParams SelfDestructParams ExplosionDamage',
    'Explosion Radius': 'SSelfDestructComponentParams SelfDestructParams ExplosionRadius',
  },
};

export default {
  csvFile: 'selfdestruct.datacore.csv',
  label: 'DC Self Destruct',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size'],
  descKeyMatch: (kl) => kl.includes('desc') && kl.includes('selfdestruct'),
  getTargetKeys: makeGetTargetKeys('sdsys_', 'SDSYS_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Self Destruct')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Explosion --')
      .rawIf('Countdown', 'Countdown')
      .rawIf('Damage', 'Explosion Damage')
      .rawIf('Radius', 'Explosion Radius')
      .build(flavorText);
  },
} satisfies ItemConfig;
