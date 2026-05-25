import { stat } from '../../lib/format/stat-builder';
import type { ItemConfig } from '../../lib/types';
import type { DataCoreItemTypeConfig } from './types';

// ⚠️ Mining laser entity class prefixes (wmn_, mlas_, wmlas_) and the p4k
// directory name are not fully confirmed. Verify against real game files.
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/weapons/mining_laser',
  // wmn_klwe_s1_arbor → strip 'wmn_' → 'KLWE_S1_ARBOR'
  entityClassPrefix: 'wmn_',
  nameKeyInfix: 'WMN_',
  fieldSelectors: {
    'Power Max': 'SWeaponMiningComponentParams MiningParams MaxPower',
    'Power Min': 'SWeaponMiningComponentParams MiningParams MinPower',
    'Range Max': 'SWeaponMiningComponentParams MiningParams MaxRange',
    'Range Min': 'SWeaponMiningComponentParams MiningParams MinRange',
    'Resistance Modifier': 'SWeaponMiningComponentParams MiningParams modifiers resistance',
    'Instability Modifier': 'SWeaponMiningComponentParams MiningParams modifiers instability',
    'Optimal Charge Zone': 'SWeaponMiningComponentParams MiningParams modifiers optimalChargeWindowSize',
    'Optimal Rate': 'SWeaponMiningComponentParams MiningParams modifiers optimalChargeRate',
  },
};

export default {
  csvFile: 'weaponmining.datacore.csv',
  label: 'DC Mining Lasers',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Power Max', 'Power Min', 'Health'],
  descKeyMatch: (kl) => kl.includes('mininglaser') && kl.includes('_desc'),
  nameKeyToDescKey(nameKey) {
    if (nameKey.startsWith('item_Mining_')) {
      return `${nameKey}_Desc`;
    }
    return nameKey.replace(/(item_)(Name|name|NAME)/, (_m, prefix: string, word: string) => {
      if (word === 'name') return `${prefix}desc`;
      if (word === 'NAME') return `${prefix}DESC`;
      return `${prefix}Desc`;
    });
  },
  // ⚠️ mining laser key derivation: use wmn_ prefix assumption.
  getTargetKeys(row, deriveDescKey) {
    const entityClass = row['Entity Class'];
    if (!entityClass) return [];
    const suffix = entityClass.replace(/^wmn_/i, '').toUpperCase();
    const nameKey = `item_NameWMN_${suffix}`;
    return [deriveDescKey(nameKey)];
  },
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Mining Laser')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Laser Stats --')
      .raw('Power Max', 'Power Max')
      .raw('Power Min', 'Power Min')
      .rawIf('Range Max', 'Range Max')
      .rawIf('Range Min', 'Range Min')
      .section('-- Rock Modifiers --')
      .rawIf('Resistance', 'Resistance Modifier')
      .rawIf('Instability', 'Instability Modifier')
      .rawIf('Optimal Charge Zone', 'Optimal Charge Zone')
      .rawIf('Optimal Rate', 'Optimal Rate')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
