import path from 'node:path';
import { readCsvFile } from '../../io/local/csv-parser';
import { findLatestMatchingFile } from '../../io/local/discovery';
import { readJsonFile } from '../../io/local/json-file';
import { resolveChildPath } from '../../io/local/path-conventions';
import { getLogger } from '../../infrastructure/logger';
import { IniTag } from '../../localization/ini-tags';
import type { ItemConfig, ItemSourceDataContext } from '../../enrichment/item-config';
import { CommodityInputSchema, CommodityResourcePoolEntrySchema } from '../../schema/scmdb/merged/pools.schema';

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

export interface CommodityCoverageDiagnostics {
  datacoreKeys: number;
  scmdbKeys: number;
  common: number;
  datacoreOnly: string[];
  scmdbOnly: string[];
}

/** Finds the latest merged-*.json file inside the given SCMDB version directory. */
async function resolveJsonFile(csvDir: string): Promise<string> {
  return findLatestMatchingFile(csvDir, (name) => name.startsWith('merged-') && name.endsWith('.json'), {
    label: 'Commodities SCMDB directory',
    notFoundMessage: `Commodities: SCMDB directory not found: ${csvDir}`,
    noMatchMessage: `Commodities: no merged-*.json found in ${csvDir}. Run scrape-scmdb.js first.`,
  });
}

export function compareCommodityCoverage(
  datacoreRows: Record<string, string>[],
  scmdbRows: Record<string, string>[],
): CommodityCoverageDiagnostics {
  const datacoreKeys = new Set(extractDataCoreCommodityKeys(datacoreRows).map((key) => key.toLowerCase()));
  const scmdbKeys = new Set(
    scmdbRows
      .map((row) => row['Localization Key'])
      .filter(Boolean)
      .map((key) => key.toLowerCase()),
  );
  const common = [...datacoreKeys].filter((key) => scmdbKeys.has(key));
  const datacoreOnly = [...datacoreKeys].filter((key) => !scmdbKeys.has(key)).sort((a, b) => a.localeCompare(b));
  const scmdbOnly = [...scmdbKeys].filter((key) => !datacoreKeys.has(key)).sort((a, b) => a.localeCompare(b));

  return {
    datacoreKeys: datacoreKeys.size,
    scmdbKeys: scmdbKeys.size,
    common: common.length,
    datacoreOnly,
    scmdbOnly,
  };
}

export function buildCommodityRowsFromSources(
  datacoreRows: Record<string, string>[],
  scmdbRows: Record<string, string>[],
): Record<string, string>[] {
  const datacoreSourceRows = datacoreRows.flatMap((row) =>
    DATACORE_KEY_COLUMNS.flatMap((column) => {
      const key = row[column]?.trim();
      return key ? [{ 'Localization Key': key, Name: '', Source: 'DataCore', 'Commodity Field': column }] : [];
    }),
  );
  const datacoreKeys = new Set(datacoreSourceRows.map((row) => row['Localization Key'].toLowerCase()));
  const fallbackRows = scmdbRows
    .filter((row) => !datacoreKeys.has(row['Localization Key'].toLowerCase()))
    .map((row) => ({ ...row, Source: row.Source || 'SCMDB', 'Commodity Field': row['Commodity Field'] || 'resourcePools' }));

  return dedupeCommodityRows([...datacoreSourceRows, ...fallbackRows]);
}

async function loadCommoditySourceData(context: ItemSourceDataContext): Promise<Record<string, string>[]> {
  const scmdbRows = await loadScmdbCommodityRows(context.csvDir);
  const datacoreRows = await loadDatacoreCommodityRows(context.sourceDirs?.datacore);
  const coverage = compareCommodityCoverage(datacoreRows, scmdbRows);

  logger.info('Commodity source coverage', {
    datacoreKeys: coverage.datacoreKeys,
    scmdbKeys: coverage.scmdbKeys,
    common: coverage.common,
    datacoreOnly: coverage.datacoreOnly.length,
    scmdbOnly: coverage.scmdbOnly.length,
  });

  return buildCommodityRowsFromSources(datacoreRows, scmdbRows);
}

async function loadScmdbCommodityRows(csvDir: string): Promise<Record<string, string>[]> {
  const rawJsonPath = await resolveJsonFile(csvDir);
  const normalizedJsonPath = path.isAbsolute(rawJsonPath) ? path.relative(csvDir, rawJsonPath) : rawJsonPath;
  const data = await readJsonFile(resolveChildPath(csvDir, normalizedJsonPath, 'Commodities SCMDB JSON filename'));
  return parseCommodityJson(data);
}

async function loadDatacoreCommodityRows(datacoreDir: string | undefined): Promise<Record<string, string>[]> {
  if (!datacoreDir) return [];

  try {
    return await readCsvFile(resolveChildPath(datacoreDir, DATACORE_COMMODITIES_CSV, 'DataCore commodities CSV filename'));
  } catch (err) {
    if (isFileNotFound(err)) {
      logger.warn('DataCore commodities CSV missing; using SCMDB commodity fallback only', {
        datacoreDir,
        csvFile: DATACORE_COMMODITIES_CSV,
      });
      return [];
    }
    throw err;
  }
}

function parseCommodityJson(data: unknown): Record<string, string>[] {
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
}

function extractDataCoreCommodityKeys(rows: Record<string, string>[]): string[] {
  return rows.flatMap((row) => DATACORE_KEY_COLUMNS.map((column) => row[column]?.trim() ?? '').filter(Boolean));
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
  // jsonFile is resolved dynamically via resolveJsonFile; no static path needed.
  resolveJsonFile,
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
  parseJson(data: unknown) {
    return parseCommodityJson(data);
  },
} satisfies ItemConfig;
