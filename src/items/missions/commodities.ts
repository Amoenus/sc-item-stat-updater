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

export function buildCommodityRowsFromSources(datacoreRows: Record<string, string>[]): Record<string, string>[] {
  const datacoreSourceRows = datacoreRows.flatMap((row) =>
    DATACORE_KEY_COLUMNS.flatMap((column) => {
      const key = row[column]?.trim();
      return key
        ? [
            {
              'Localization Key': key,
              Name: '',
              Source: 'DataCore',
              'Commodity Field': column,
              'Warning Tag': shouldWarnCommodityKey(row, column) ? '1' : '',
            },
          ]
        : [];
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

function shouldWarnCommodityKey(row: Record<string, string>, column: (typeof DATACORE_KEY_COLUMNS)[number]): boolean {
  if (column !== 'Name Key' && column !== 'Display Name Key') return false;
  return row['Display Type Key'] === 'items_commodities_type_vice' || /[/\\]commodities[/\\]vice[/\\]/i.test(row['Record Path'] ?? '');
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
  buildValue(row, _flavorText, oldValue, _targetKey) {
    const showWarning = row['Warning Tag'] === '1';
    const prefix = showWarning ? `${IniTag.EM3.wrap('[!]')} ` : '';
    const displayName = row.Name || oldValue.replace(`${IniTag.EM3.wrap('[!]')} `, '');
    return `${prefix}${displayName}`;
  },
} satisfies ItemConfig;
