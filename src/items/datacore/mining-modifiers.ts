import { stat } from '../../lib/format/stat-builder';
import type { ItemConfig } from '../../lib/types';
import type { DataCoreItemTypeConfig } from './types';

// ⚠️ Mining modifier entity class prefix (mmod_) and the DataForge directory
// name are not confirmed. The INI key pattern differs from standard items
// (uses item_Mining_* style). Verify against real game files.
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/utility/mining/miningarm',
  entityClassPrefix: 'mmod_',
  nameKeyInfix: 'MMOD_',
  fieldSelectors: {
    'Type': 'SMiningModifierComponentParams MiningModifierParams consumableType',
    'Charges': 'SMiningModifierComponentParams MiningModifierParams charges',
    'Duration': 'SMiningModifierComponentParams MiningModifierParams duration',
    'Resistance': 'SMiningModifierComponentParams MiningModifierParams modifiers resistance',
    'Instability': 'SMiningModifierComponentParams MiningModifierParams modifiers instability',
    'Optimal Charge Zone': 'SMiningModifierComponentParams MiningModifierParams modifiers optimalChargeWindowSize',
    'Optimal Rate': 'SMiningModifierComponentParams MiningModifierParams modifiers optimalChargeRate',
    'Shatter Damage': 'SMiningModifierComponentParams MiningModifierParams modifiers shatterDamageMod',
    'Cluster Factor': 'SMiningModifierComponentParams MiningModifierParams modifiers clusterFactor',
    'Overcharge Rate': 'SMiningModifierComponentParams MiningModifierParams modifiers overchargeRate',
    'Inert Materials': 'SMiningModifierComponentParams MiningModifierParams modifiers inertMaterialsMod',
  },
};

export default {
  csvFile: 'miningmodifier.datacore.csv',
  label: 'DC Mining Modifiers',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Charges', 'Duration'],
  descKeyMatch: (kl) =>
    (kl.startsWith('item_mining_consumable_') && kl.endsWith('_desc')) ||
    (kl.startsWith('item_mining_gadget_') && kl.endsWith('_desc')) ||
    (kl.startsWith('item_mining_modules_') && kl.endsWith('_desc')),
  nameKeyToDescKey: (nameKey) => (nameKey.endsWith('_Name') ? nameKey.replace(/_Name$/, '_Desc') : `${nameKey}_Desc`),
  // ⚠️ Mining modifier INI keys use a different naming convention (e.g.
  // item_mining_consumable_arden_Name). Derivation from entity class is
  // highly uncertain — manual mapping may be needed.
  getTargetKeys(row, deriveDescKey) {
    const entityClass = row['Entity Class'];
    if (!entityClass) return [];
    // Best-effort: try known mining-consumable prefix patterns
    const candidates = [
      `item_mining_consumable_${entityClass.replace(/^mmod_/i, '').toLowerCase()}_Name`,
      `item_mining_gadget_${entityClass.replace(/^mmod_/i, '').toLowerCase()}_Name`,
      `item_mining_modules_${entityClass.replace(/^mmod_/i, '').toLowerCase()}_Name`,
    ];
    return candidates.flatMap((key) => [deriveDescKey(key)]);
  },
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', r['Type'] || 'Mining Modifier')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Charges', 'Charges')
      .raw('Duration', 'Duration')
      .section('-- Rock Modifiers --')
      .rawIf('Resistance', 'Resistance')
      .rawIf('Instability', 'Instability')
      .rawIf('Optimal Charge Zone', 'Optimal Charge Zone')
      .rawIf('Optimal Rate', 'Optimal Rate')
      .rawIf('Shatter Damage', 'Shatter Damage')
      .rawIf('Cluster Factor', 'Cluster Factor')
      .rawIf('Overcharge Rate', 'Overcharge Rate')
      .rawIf('Inert Materials', 'Inert Materials')
      .build(flavorText);
  },
} satisfies ItemConfig;
