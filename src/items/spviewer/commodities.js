// @ts-check

const ILLEGAL_COMMODITY_KEYS = new Set([
  'items_commodities_altruciatoxin_unprocessed',
  'items_commodities_altruciatoxin',
  'items_commodities_GaspingWeevilEggs',
  'items_commodities_widow',
  'items_commodities_slam',
  'items_commodities_neon',
  'items_commodities_maze',
  'items_commodities_etam',
].map((key) => key.toLowerCase()));

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  jsonFile: 'scmdb/merged-4.8.0-ptu.11759767.json',
  label: 'Commodities',
  requiredColumns: ['Localization Key', 'Name'],
  descKeyMatch: (kl) => kl.startsWith('items_commodities_') && kl.endsWith('_desc'),
  getTargetKeys(row) {
    return [row['Localization Key']];
  },
  buildValue(row, _flavorText, _oldValue, targetKey) {
    const displayName = row['Name'];
    const prefix = ILLEGAL_COMMODITY_KEYS.has(targetKey.toLowerCase()) ? '<EM3>[!]</EM3> ' : '';
    return `${prefix}${displayName}`;
  },
  parseJson(data) {
    if (!data || typeof data !== 'object' || !data.resourcePools || typeof data.resourcePools !== 'object') {
      return [];
    }
    return Object.values(data.resourcePools)
      .filter((entry) => entry && typeof entry === 'object' && entry.nameKey && entry.name)
      .map((entry) => ({
        'Localization Key': entry.nameKey,
        Name: entry.name,
      }));
  },
};
