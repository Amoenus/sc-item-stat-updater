import type { ItemConfig, ItemSourceDataContext } from '../../enrichment/item-config';
import { getLogger } from '../../infrastructure/logger';
import { readCsvFile } from '../../io/local/csv-parser';
import { resolveChildPath } from '../../io/local/path-conventions';
import { IniTag } from '../../localization/ini-tags';

const logger = getLogger('commodities-config');
const DATACORE_COMMODITIES_CSV = 'commodities.datacore.csv';
const DATACORE_KEY_COLUMNS = [
  'Name Key',
  'Description Key',
  'Display Name Key',
  'Display Description Key',
  'Display Type Key',
] as const;

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

export function buildCommodityRowsFromSources(datacoreRows: Record<string, string>[]): Record<string, string>[] {
  const datacoreSourceRows = datacoreRows.flatMap((row) =>
    DATACORE_KEY_COLUMNS.flatMap((column) => {
      const key = row[column]?.trim();
      return key ? [{ 'Localization Key': key, Name: '', Source: 'DataCore', 'Commodity Field': column }] : [];
    }),
  );

  return dedupeCommodityRows(datacoreSourceRows);
}

async function loadCommoditySourceData(context: ItemSourceDataContext): Promise<Record<string, string>[]> {
  const datacoreRows = await loadDatacoreCommodityRows(context.sourceDirs?.datacore);
  const rows = buildCommodityRowsFromSources(datacoreRows);

  logger.info('Commodity source coverage', {
    datacoreRows: datacoreRows.length,
    datacoreKeys: rows.length,
  });

  return rows;
}

async function loadDatacoreCommodityRows(datacoreDir: string | undefined): Promise<Record<string, string>[]> {
  if (!datacoreDir) return [];

  try {
    return await readCsvFile(
      resolveChildPath(datacoreDir, DATACORE_COMMODITIES_CSV, 'DataCore commodities CSV filename'),
    );
  } catch (err) {
    if (isFileNotFound(err)) {
      logger.warn('DataCore commodities CSV missing; using empty commodity source data', {
        datacoreDir,
        csvFile: DATACORE_COMMODITIES_CSV,
      });
      return [];
    }
    throw err;
  }
}

function dedupeCommodityRows(rows: Record<string, string>[]): Record<string, string>[] {
  const seen = new Set<string>();
  const result: Record<string, string>[] = [];
  for (const row of rows) {
    const key = row['Localization Key']?.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

function isFileNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'ENOENT';
}

export default {
  sourceFiles: [{ file: DATACORE_COMMODITIES_CSV, sourceDir: 'datacore' }],
  loadSourceData: loadCommoditySourceData,
  label: 'Commodities',
  requiredColumns: ['Localization Key', 'Name'],
  descKeyMatch: (kl) => kl.startsWith('items_commodities_') && kl.endsWith('_desc'),
  getTargetKeys(row) {
    return [row['Localization Key']];
  },
  buildValue(row, _flavorText, oldValue, targetKey) {
    const isIllegal = ILLEGAL_COMMODITY_KEYS.has(targetKey.toLowerCase());
    const prefix = isIllegal ? `${IniTag.EM3.wrap('[!]')} ` : '';
    const displayName = row.Name || oldValue.replace(`${IniTag.EM3.wrap('[!]')} `, '');
    return `${prefix}${displayName}`;
  },
} satisfies ItemConfig;
