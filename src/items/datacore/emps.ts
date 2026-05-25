import { stat } from '../../lib/format/stat-builder';
import type { ItemConfig } from '../../lib/types';
import { makeGetTargetKeys, type DataCoreItemTypeConfig } from './types';

// ⚠️ EMP entity class prefix and DataForge component structure are speculative.
// The p4k path may be scitemweapon_emp or scitemvehicle_weaponemp.
// Verify against real game files.
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/weapons/emp',
  // emp_kbar_s2_headhunterII → strip 'emp_' → 'KBAR_S2_HEADHUNTERII'
  entityClassPrefix: 'emp_',
  nameKeyInfix: 'EMP_',
  fieldSelectors: {
    'Damage Total': 'SEMPComponentParams EMPParams MaxDamage',
    'Damage Radius': 'SEMPComponentParams EMPParams MaxRadius',
    'Charge Delay': 'SEMPComponentParams EMPParams ChargeUpTime',
    'Unleash Delay': 'SEMPComponentParams EMPParams UnleashDelay',
    'Cooldown': 'SEMPComponentParams EMPParams CooldownTime',
  },
};

export default {
  csvFile: 'emp.datacore.csv',
  label: 'DC EMPs',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Damage Total', 'Damage Radius', 'Health'],
  descKeyMatch: (kl) => kl.includes('desc') && kl.includes('emp'),
  getTargetKeys: makeGetTargetKeys('emp_', 'EMP_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'EMP Generator')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- EMP Stats --')
      .raw('Damage', 'Damage Total')
      .raw('Radius', 'Damage Radius')
      .rawIf('Charge Delay', 'Charge Delay')
      .rawIf('Unleash Delay', 'Unleash Delay')
      .rawIf('Cooldown', 'Cooldown')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
