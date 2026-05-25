import { stat } from '../../lib/format/stat-builder';
import type { ItemConfig } from '../../lib/types';
import type { DataCoreItemTypeConfig } from './types';

// ⚠️ Salvage modifier entity classes use varying prefixes (smod_, scrp_, etc.)
// and their INI keys follow a different naming convention (item_scraper_*).
// Verify all values against real game files.
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/utility/salvage/salvagemodifiers',
  entityClassPrefix: 'smod_',
  nameKeyInfix: 'SMOD_',
  fieldSelectors: {
    'Speed Multiplier': 'SSalvageModifierComponentParams SalvageModifierParams SpeedMultiplier',
    'Radius Multiplier': 'SSalvageModifierComponentParams SalvageModifierParams RadiusMultiplier',
    'Extraction Efficiency': 'SSalvageModifierComponentParams SalvageModifierParams ExtractionEfficiency',
  },
};

export default {
  csvFile: 'salvagemodifier.datacore.csv',
  label: 'DC Salvage Modifiers',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size'],
  descKeyMatch: (kl) =>
    (kl.startsWith('item_scraper_') && kl.endsWith('_desc')) || kl === 'item_descgrin_tractorbeam_module_001',
  nameKeyToDescKey: (nameKey) =>
    nameKey.endsWith('_Name') ? nameKey.replace(/_Name$/, '_Desc') : nameKey.replace(/^item_Name/, 'item_Desc'),
  // ⚠️ Salvage modifier INI keys use item_scraper_* convention. Key derivation
  // from entity class is speculative. Manual mapping may be required.
  getTargetKeys(row, deriveDescKey) {
    const entityClass = row['Entity Class'];
    if (!entityClass) return [];
    const suffix = entityClass.replace(/^smod_/i, '').toLowerCase();
    return [deriveDescKey(`item_scraper_${suffix}_Name`)];
  },
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Salvage Modifier')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Salvage Stats --')
      .rawIf('Speed Multiplier', 'Speed Multiplier')
      .rawIf('Radius Multiplier', 'Radius Multiplier')
      .rawIf('Extraction Efficiency', 'Extraction Efficiency')
      .build(flavorText);
  },
} satisfies ItemConfig;
