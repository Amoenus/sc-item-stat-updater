import { stat } from '../../lib/format/stat-builder';
import type { ItemConfig } from '../../lib/types';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

// ⚠️ Verify p4kFilter, entityClassPrefix, nameKeyInfix and fieldSelectors
// against real unforged game files.
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/cooler',
  // cool_acom_s01_iceplunge → strip 'cool_' → 'ACOM_S01_ICEPLUNGE' → item_NameCOOL_ACOM_S01_ICEPLUNGE
  entityClassPrefix: 'cool_',
  nameKeyInfix: 'COOL_',
  fieldSelectors: {
    'Cooling Rate': {
      selector: 'generation[resource="Coolant"] SStandardResourceUnit',
      attr: 'standardResourceUnits',
    },
  },
};

export default {
  csvFile: 'cooler.datacore.csv',
  label: 'DC Coolers',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Grade', 'Cooling Rate', 'Health'],
  descKeyMatch: (kl) => kl.includes('desccool_') || kl.includes('desc_cool_'),
  // Coolers use an irregular nameKey → descKey mapping: item_Name_COOL_ ↔ item_Desc_COOL_
  nameKeyToDescKey(nameKey) {
    return nameKey.replace(/(item_)(Name|name|NAME)_?(?=COOL_)/i, '$1Desc_');
  },
  getAlternateDescKeys(descKey) {
    const altKeys: string[] = [];
    if (descKey.includes('item_Desc_COOL_')) {
      altKeys.push(descKey.replace('item_Desc_COOL_', 'item_DescCOOL_'));
    }
    if (descKey.includes('item_DescCOOL_')) {
      altKeys.push(descKey.replace('item_DescCOOL_', 'item_Desc_COOL_'));
    }
    return altKeys;
  },
  getTargetKeys: makeGetTargetKeys('cool_', 'COOL_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Cooler')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Grade', 'Grade')
      .lineIf('Class', r['Class'])
      .section('-- Cooling Stats --')
      .raw('Cooling Rate', 'Cooling Rate')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
