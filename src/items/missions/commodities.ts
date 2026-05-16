import type { ItemConfig } from '../../lib/types.js';
import { findLatestMatchingFile } from '../../io/local/discovery.js';

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

/**
 * Finds the latest merged-*.json file inside the given SCMDB version directory.
 *
 * @param {string} csvDir - the versioned SCMDB directory (e.g. csv/scmdb/4.1.1-live.9800000)
 * @returns {Promise<string>} resolved absolute path to the json file
 */
async function resolveJsonFile(csvDir: string): Promise<string> {
  return findLatestMatchingFile(csvDir, (name) => name.startsWith('merged-') && name.endsWith('.json'), {
    label: 'Commodities SCMDB directory',
    notFoundMessage: `Commodities: SCMDB directory not found: ${csvDir}`,
    noMatchMessage: `Commodities: no merged-*.json found in ${csvDir}. Run scrape-scmdb.js first.`,
  });
}

/** @type {import('../../lib/types.js').ItemConfig} */
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
    const prefix = isIllegal ? '<EM3>[!]</EM3> ' : '';
    const displayName = row['Name'] || oldValue.replace('<EM3>[!]</EM3> ', '');
    return `${prefix}${displayName}`;
  },
  parseJson(data: unknown) {
    if (!data || typeof data !== 'object' || !('resourcePools' in data) || !data.resourcePools || typeof data.resourcePools !== 'object') {
      return [...ILLEGAL_COMMODITY_KEYS].map((key) => ({ 'Localization Key': key, Name: '' }));
    }
    const rows = Object.values(data.resourcePools as Record<string, unknown>)
      .filter((entry): entry is { nameKey: string; name: string } => !!entry && typeof entry === 'object' && 'nameKey' in entry && 'name' in entry && typeof (entry as {nameKey:unknown}).nameKey === 'string' && typeof (entry as {name:unknown}).name === 'string')
      .map((entry) => ({
        'Localization Key': entry.nameKey,
        Name: entry.name,
      }));
    const presentKeys = new Set(rows.map((r) => r['Localization Key'].toLowerCase()));
    for (const key of ILLEGAL_COMMODITY_KEYS) {
      if (!presentKeys.has(key)) {
        rows.push({ 'Localization Key': key, Name: '' });
      }
    }
    return rows;
  },
} satisfies ItemConfig;
