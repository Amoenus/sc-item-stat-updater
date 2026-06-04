import { stat } from '../../enrichment/stat-builder';
import type { ItemConfig } from '../../enrichment/item-config';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

// ⚠️ Verify p4kFilter, entityClassPrefix, nameKeyInfix and fieldSelectors
// against real unforged game files. Countermeasure entity class names vary
// by type (chaff_, flare_, noise_). The 'wcm_' prefix is speculative.
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/countermeasures',
  // wcm_kbar_s1_chaff → strip 'wcm_' → 'KBAR_S1_CHAFF'
  entityClassPrefix: 'wcm_',
  nameKeyInfix: 'WPCM_',
  fieldSelectors: {
    Type: 'SCountermeasureComponentParams CountermeasureParams type',
    'Ammo Quantity': 'SAmmoContainerComponentParams capacity',
    'Ammo Speed': 'SCountermeasureComponentParams CountermeasureParams speed',
    'Ammo Lifetime': 'SCountermeasureComponentParams CountermeasureParams lifetime',
    'Signature IR': 'SCountermeasureComponentParams CountermeasureParams signatureIR',
    'Signature CS': 'SCountermeasureComponentParams CountermeasureParams signatureCS',
    'Signature EM': 'SCountermeasureComponentParams CountermeasureParams signatureEM',
  },
};

export default {
  csvFile: 'weapondefensive.datacore.csv',
  label: 'DC Defensive Weapons',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Health'],
  descKeyMatch: (kl) =>
    kl.includes('desc') &&
    (kl.includes('chaff') || kl.includes('flare') || kl.includes('noise') || kl.includes('countermeasure')),
  getTargetKeys: makeGetTargetKeys('wcm_', 'WPCM_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', r['Type'] || 'Defensive Weapon')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Ammo --')
      .rawIf('Quantity', 'Ammo Quantity')
      .rawIf('Speed', 'Ammo Speed')
      .rawIf('Lifetime', 'Ammo Lifetime')
      .section('-- Signatures --')
      .rawIf('IR', 'Signature IR')
      .rawIf('CS', 'Signature CS')
      .rawIf('EM', 'Signature EM')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
