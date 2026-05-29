import { findLatestMatchingFile } from '../../io/local/discovery';
import { IniTag } from '../../lib/ini-tags';
import type { ItemConfig } from '../../lib/types';
import { CommodityInputSchema, CommodityResourcePoolEntrySchema } from '../../schema/scmdb/merged/pools.schema';

const ILLEGAL_COMMODITY_KEYS = new Set(
  [
    'items_commodities_altruciatoxin_unprocessed',
    'items_commodities_altruciatoxin',
    'items_commodities_GaspingWeevilEggs',
    'items_commodities_widow',
    'items_commodities_slam',
    'items_commodities_neon',
    'items_commodities_maze',
    'items_commodities_etam',
  ].map((key) => key.toLowerCase()),
);

/** Finds the latest merged-*.json file inside the given SCMDB version directory. */
async function resolveJsonFile(csvDir: string): Promise<string> {
  return findLatestMatchingFile(csvDir, (name) => name.startsWith('merged-') && name.endsWith('.json'), {
    label: 'Commodities SCMDB directory',
    notFoundMessage: `Commodities: SCMDB directory not found: ${csvDir}`,
    noMatchMessage: `Commodities: no merged-*.json found in ${csvDir}. Run scrape-scmdb.js first.`,
  });
}

export default {
  // jsonFile is resolved dynamically via resolveJsonFile — no static path needed.
  resolveJsonFile,
  label: 'Commodities',
  requiredColumns: ['Localization Key', 'Name'],
  descKeyMatch: (kl) => kl.startsWith('items_commodities_') && kl.endsWith('_desc'),
  getTargetKeys(row) {
    return [row['Localization Key']];
  },
  buildValue(row, _flavorText, oldValue, targetKey) {
    const isIllegal = ILLEGAL_COMMODITY_KEYS.has(targetKey.toLowerCase());
    const prefix = isIllegal ? `${IniTag.EM3.wrap('[!]')} ` : '';
    const displayName = row['Name'] || oldValue.replace(`${IniTag.EM3.wrap('[!]')} `, '');
    return `${prefix}${displayName}`;
  },
  parseJson(data: unknown) {
    const input = CommodityInputSchema.safeParse(data);
    if (!input.success) {
      return [...ILLEGAL_COMMODITY_KEYS].map((key) => ({ 'Localization Key': key, Name: '' }));
    }
    const rows = Object.values(input.data.resourcePools).flatMap((entry) => {
      const parsed = CommodityResourcePoolEntrySchema.safeParse(entry);
      return parsed.success ? [{ 'Localization Key': parsed.data.nameKey, Name: parsed.data.name }] : [];
    });
    const presentKeys = new Set(rows.map((r) => r['Localization Key'].toLowerCase()));
    for (const key of ILLEGAL_COMMODITY_KEYS) {
      if (!presentKeys.has(key)) {
        rows.push({ 'Localization Key': key, Name: '' });
      }
    }
    return rows;
  },
} satisfies ItemConfig;
