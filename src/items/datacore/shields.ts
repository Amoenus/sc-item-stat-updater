import { stat } from '../../lib/format/stat-builder';
import type { ItemConfig } from '../../lib/types';
import { makeGetTargetKeys, type DataCoreItemTypeConfig } from './types';

/**
 * DataForge XML field selectors for shield generator stats.
 * Paths are CSS selectors evaluated in cheerio XML mode against the
 * unforged entity class XML. Verified field names against DataForge schema:
 * SShieldGeneratorComponentParams → ShieldGeneratorParams
 *
 * ⚠️ Exact XML paths should be verified against real unforged game files.
 */
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  // Data/libs/foundry/records/entities/scitem/ships/shieldgenerator/
  recordFilter: 'scitem/ships/shieldgenerator',
  // shld_aegs_s04_reclaimer → strip 'shld_' → 'AEGS_S04_RECLAIMER' → item_NameSHLD_AEGS_S04_RECLAIMER
  entityClassPrefix: 'shld_',
  nameKeyInfix: 'SHLD_',
  fieldSelectors: {
    'HP Pool':       { selector: 'SCItemShieldGeneratorParams', attr: 'MaxShieldHealth' },
    'Regen Rate':    { selector: 'SCItemShieldGeneratorParams', attr: 'MaxShieldRegen' },
    'Damaged Delay': { selector: 'SCItemShieldGeneratorParams', attr: 'DamagedRegenDelay' },
    'Downed Delay':  { selector: 'SCItemShieldGeneratorParams', attr: 'DownedRegenDelay' },
  },
};

export default {
  csvFile: 'shield.datacore.csv',
  label: 'DC Shields',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Grade', 'HP Pool', 'Regen Rate', 'Health'],
  descKeyMatch: (kl) => kl.includes('descshld_') || kl.includes('desc_shld_'),
  getTargetKeys: makeGetTargetKeys('shld_', 'SHLD_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Shield Generator')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Grade', 'Grade')
      .lineIf('Class', r['Class'])
      .section('-- Shield Stats --')
      .raw('Pool HP', 'HP Pool')
      .raw('Regen Rate', 'Regen Rate')
      .rawIf('Regen Time', 'Regen Time')
      .rawIf('Damaged Delay', 'Damaged Delay')
      .rawIf('Downed Delay', 'Downed Delay')
      .section('-- Absorption --')
      .rawIf('Physical', 'Absorption Physical')
      .rawIf('Energy', 'Absorption Energy')
      .rawIf('Distortion', 'Absorption Distortion')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
