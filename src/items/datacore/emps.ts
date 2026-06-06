import type { ItemConfig } from '../../enrichment/item-config';
import { stat } from '../../enrichment/stat-builder';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/weapons/emp',
  // emp_kbar_s2_headhunterII -> strip 'emp_' -> 'KBAR_S2_HEADHUNTERII'
  entityClassPrefix: 'emp_',
  nameKeyInfix: 'EMP_',
  fieldSelectors: {
    'Damage Total': { selector: 'SCItemEMPParams', attr: 'distortionDamage' },
    'Damage Radius': { selector: 'SCItemEMPParams', attr: 'empRadius' },
    'Damage Radius Min': { selector: 'SCItemEMPParams', attr: 'minEmpRadius' },
    'Physical Radius': { selector: 'SCItemEMPParams', attr: 'physRadius' },
    'Physical Radius Min': { selector: 'SCItemEMPParams', attr: 'minPhysRadius' },
    Pressure: { selector: 'SCItemEMPParams', attr: 'pressure' },
    'Charge Delay': { selector: 'SCItemEMPParams', attr: 'chargeTime' },
    'Unleash Delay': { selector: 'SCItemEMPParams', attr: 'unleashTime' },
    Cooldown: { selector: 'SCItemEMPParams', attr: 'cooldownTime' },
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
      .rawIf('Min Radius', 'Damage Radius Min')
      .rawIf('Physical Radius', 'Physical Radius')
      .rawIf('Min Physical Radius', 'Physical Radius Min')
      .rawIf('Pressure', 'Pressure')
      .rawIf('Charge Delay', 'Charge Delay')
      .rawIf('Unleash Delay', 'Unleash Delay')
      .rawIf('Cooldown', 'Cooldown')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
