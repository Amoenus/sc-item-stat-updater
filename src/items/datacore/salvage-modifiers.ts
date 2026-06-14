import type { ItemConfig } from '../../enrichment/item-config';
import { stat } from '../../enrichment/stat-builder';
import { type DataCoreItemTypeConfig, resolvePatchableDataCoreDescriptionTargets } from './types';

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  // Verified against real unforged XML cache. Entity files live at:
  //   libs/foundry/records/entities/scitem/ships/utility/salvage/salvagemodifiers/
  // Includes scraper modules (salvage_modifier_scraper_*), tractor modules
  // (salvage_modifier_tractor_*), and ship-integrated buff modifiers
  // (salvage_buff_modifier_*).
  recordFilter: 'scitem/ships/utility/salvage/salvagemodifiers',
  // Entity class names are salvage_modifier_* or salvage_buff_modifier_*
  entityClassPrefix: 'salvage_modifier_',
  nameKeyInfix: 'SALVAGE_MODIFIER_',
  fieldSelectors: {
    // All three stats live in the salvageModifier element inside weaponStats,
    // which is part of the ItemWeaponModifiersParams component.
    'Speed Multiplier': {
      selector: 'ItemWeaponModifiersParams salvageModifier',
      attr: 'salvageSpeedMultiplier',
    },
    'Radius Multiplier': {
      selector: 'ItemWeaponModifiersParams salvageModifier',
      attr: 'radiusMultiplier',
    },
    'Extraction Efficiency': {
      selector: 'ItemWeaponModifiersParams salvageModifier',
      attr: 'extractionEfficiency',
    },
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
  getTargetKeys(row, deriveDescKey) {
    return resolvePatchableDataCoreDescriptionTargets(row, deriveDescKey);
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
