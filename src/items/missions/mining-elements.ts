import { readCsvFile } from '../../io/local/csv-parser';
import { resolveChildPath } from '../../io/local/path-conventions';
import { getLogger } from '../../infrastructure/logger';
import { deriveClusterNote, deriveMiningDifficulty, deriveVolatilityNote } from '../../extractor/mining-parser';
import type { ItemConfig } from '../../enrichment/item-config';
import type { ItemSourceDataContext } from '../../enrichment/item-config';

const SUFFIXLESS_TARGETS: Record<string, string> = {};
const COMMODITY_SLUG_ALIASES: Record<string, string> = {
  aluminium: 'aluminum',
};
const DATACORE_MINING_ELEMENTS_CSV = 'mining-elements.datacore.csv';
const logger = getLogger('mining-elements-config');

function toCommoditySlug(name: string): string {
  const slug = name.toLowerCase().replace(/[\s-]/g, '');
  return COMMODITY_SLUG_ALIASES[slug] ?? slug;
}

function appendIfPresent(lines: string[], label: string, value: string | undefined): void {
  if (value && value.trim() !== '') lines.push(`${label}: ${value}`);
}

export interface MiningElementCoverageDiagnostics {
  datacoreKeys: number;
  scmdbKeys: number;
  common: number;
  datacoreOnly: string[];
  scmdbOnly: string[];
}

export function compareMiningElementCoverage(
  datacoreRows: Record<string, string>[],
  scmdbRows: Record<string, string>[],
): MiningElementCoverageDiagnostics {
  const datacoreKeys = new Set(datacoreRows.map((row) => row['Inferred Description Key']).filter(Boolean).map((key) => key.toLowerCase()));
  const scmdbKeys = new Set(scmdbRows.flatMap((row) => inferTargetKeys(row)).map((key) => key.toLowerCase()));
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

export function buildMiningElementRowsFromSources(
  datacoreRows: Record<string, string>[],
  scmdbRows: Record<string, string>[],
): Record<string, string>[] {
  const scmdbByTarget = new Map<string, Record<string, string>>();
  const mergedRows: Record<string, string>[] = [];

  for (const row of scmdbRows) {
    const targetKey = inferTargetKeys(row)[0];
    if (targetKey) scmdbByTarget.set(targetKey.toLowerCase(), row);
    mergedRows.push({ ...row, Source: row.Source || 'SCMDB' });
  }

  for (const datacoreRow of datacoreRows) {
    const targetKey = datacoreRow['Inferred Description Key']?.trim();
    if (!targetKey) continue;

    const scmdbRow = scmdbByTarget.get(targetKey.toLowerCase());
    const merged = toMiningElementRow(datacoreRow, scmdbRow);
    const existingIndex = mergedRows.findIndex((row) => inferTargetKeys(row)[0]?.toLowerCase() === targetKey.toLowerCase());
    if (existingIndex === -1) {
      mergedRows.push(merged);
    } else {
      mergedRows[existingIndex] = merged;
    }
  }

  return mergedRows;
}

async function loadMiningElementSourceData(context: ItemSourceDataContext): Promise<Record<string, string>[]> {
  const scmdbRows = await readCsvFile(resolveChildPath(context.csvDir, 'mining-elements.csv', 'SCMDB mining elements CSV filename'));
  const datacoreRows = await loadDatacoreMiningElementRows(context.sourceDirs?.datacore);
  const coverage = compareMiningElementCoverage(datacoreRows, scmdbRows);

  logger.info('Mining element source coverage', {
    datacoreKeys: coverage.datacoreKeys,
    scmdbKeys: coverage.scmdbKeys,
    common: coverage.common,
    datacoreOnly: coverage.datacoreOnly.length,
    scmdbOnly: coverage.scmdbOnly.length,
  });

  return buildMiningElementRowsFromSources(datacoreRows, scmdbRows);
}

async function loadDatacoreMiningElementRows(datacoreDir: string | undefined): Promise<Record<string, string>[]> {
  if (!datacoreDir) return [];

  try {
    return await readCsvFile(resolveChildPath(datacoreDir, DATACORE_MINING_ELEMENTS_CSV, 'DataCore mining elements CSV filename'));
  } catch (err) {
    if (isFileNotFound(err)) {
      logger.warn('DataCore mining elements CSV missing; using SCMDB mining element fallback only', {
        datacoreDir,
        csvFile: DATACORE_MINING_ELEMENTS_CSV,
      });
      return [];
    }
    throw err;
  }
}

function toMiningElementRow(datacoreRow: Record<string, string>, scmdbRow: Record<string, string> | undefined): Record<string, string> {
  const behaviorFacts = toDatacoreBehaviorFacts(datacoreRow);
  return {
    'Element Name': datacoreRow['Element Name'] || scmdbRow?.['Element Name'] || '',
    Rarity: scmdbRow?.Rarity || '',
    'Ground Scan Signature': scmdbRow?.['Ground Scan Signature'] || '',
    'FPS Scan Signature': scmdbRow?.['FPS Scan Signature'] || '',
    'Scan Signature': scmdbRow?.['Scan Signature'] || '',
    Resistance: datacoreRow.Resistance || scmdbRow?.Resistance || '',
    Instability: datacoreRow.Instability || scmdbRow?.Instability || '',
    Density: scmdbRow?.Density || '',
    'Optimal Window Midpoint': datacoreRow['Optimal Window Midpoint'] || scmdbRow?.['Optimal Window Midpoint'] || '',
    'Optimal Window Randomness': datacoreRow['Optimal Window Randomness'] || scmdbRow?.['Optimal Window Randomness'] || '',
    'Optimal Window Thinness': datacoreRow['Optimal Window Thinness'] || scmdbRow?.['Optimal Window Thinness'] || '',
    'Explosion Multiplier': datacoreRow['Explosion Multiplier'] || scmdbRow?.['Explosion Multiplier'] || '',
    'Cluster Factor': datacoreRow['Cluster Factor'] || scmdbRow?.['Cluster Factor'] || '',
    'Quality Bands': scmdbRow?.['Quality Bands'] || '',
    'Material Name': scmdbRow?.['Material Name'] || '',
    'Mining Difficulty': behaviorFacts ? deriveMiningDifficulty(behaviorFacts) : scmdbRow?.['Mining Difficulty'] || '',
    'Volatility Note': behaviorFacts ? deriveVolatilityNote(behaviorFacts) : scmdbRow?.['Volatility Note'] || '',
    'Cluster Note':
      behaviorFacts?.clusterFactor !== undefined ? deriveClusterNote(behaviorFacts.clusterFactor) : scmdbRow?.['Cluster Note'] || '',
    'Best Refinery': scmdbRow?.['Best Refinery'] || '',
    'Localization Key': datacoreRow['Inferred Description Key'] || '',
    Source: scmdbRow ? 'DataCore+SCMDB' : 'DataCore',
  };
}

function toDatacoreBehaviorFacts(row: Record<string, string>):
  | {
      resistance?: number;
      instability?: number;
      optimalWindowThinness?: number;
      optimalWindowRandomness?: number;
      explosionMultiplier?: number;
      clusterFactor?: number;
    }
  | undefined {
  const facts = {
    resistance: parseOptionalNumber(row.Resistance),
    instability: parseOptionalNumber(row.Instability),
    optimalWindowThinness: parseOptionalNumber(row['Optimal Window Thinness']),
    optimalWindowRandomness: parseOptionalNumber(row['Optimal Window Randomness']),
    explosionMultiplier: parseOptionalNumber(row['Explosion Multiplier']),
    clusterFactor: parseOptionalNumber(row['Cluster Factor']),
  };
  return Object.values(facts).some((value) => value !== undefined) ? facts : undefined;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function inferTargetKeys(row: Record<string, string>): string[] {
  const elementName = row['Element Name'];
  if (!elementName) return [];

  const suffixMatch = /^(.+?)\s*\((\w+)\)\s*$/.exec(elementName);
  if (suffixMatch) {
    const baseName = suffixMatch[1];
    const suffix = suffixMatch[2].toLowerCase();
    if (suffix !== 'ore' && suffix !== 'raw') return [];
    return [`items_commodities_${toCommoditySlug(baseName)}_${suffix}_desc`];
  }

  const mappedTarget = SUFFIXLESS_TARGETS[elementName] ?? SUFFIXLESS_TARGETS[toCommoditySlug(elementName)];
  return mappedTarget ? [mappedTarget] : [];
}

function isFileNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'ENOENT';
}

export default {
  csvFile: 'mining-elements.csv',
  loadSourceData: loadMiningElementSourceData,
  label: 'Mining element stats',
  requiredColumns: ['Element Name', 'Rarity', 'Scan Signature', 'Resistance', 'Instability'],
  noInsert: true,
  descKeyMatch: (kl: string) =>
    kl.startsWith('items_commodities_') && (kl.endsWith('_ore_desc') || kl.endsWith('_raw_desc')),

  getTargetKeys(row, _deriveDescKey) {
    return inferTargetKeys(row);
  },

  buildValue(row, _flavorText, oldValue, _targetKey) {
    const statsBlockMarker = String.raw`\n\n** Scanner Data **`;
    const statsBlockIndex = oldValue.indexOf(statsBlockMarker);
    const cleanFlavorText = statsBlockIndex === -1 ? oldValue : oldValue.substring(0, statsBlockIndex);

    const rarity = row['Rarity'] || 'N/A';
    const formattedRarity = rarity === 'N/A' ? 'N/A' : rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase();
    const scannerLines = [`Rarity: ${formattedRarity}`, `Scan Signature: ${row['Scan Signature'] || 'N/A'}`];
    appendIfPresent(scannerLines, 'Ground Scan Signature', row['Ground Scan Signature']);
    appendIfPresent(scannerLines, 'FPS Scan Signature', row['FPS Scan Signature']);
    appendIfPresent(scannerLines, 'Density', row.Density);
    scannerLines.push(`Resistance: ${row.Resistance || 'N/A'}`, `Instability: ${row.Instability || 'N/A'}`);

    const behaviorLines: string[] = [];
    appendIfPresent(behaviorLines, 'Difficulty', row['Mining Difficulty']);
    appendIfPresent(behaviorLines, 'Optimal Charge', row['Optimal Window Midpoint']);
    appendIfPresent(behaviorLines, 'Window Variance', row['Optimal Window Randomness']);
    appendIfPresent(behaviorLines, 'Window Width', row['Optimal Window Thinness']);
    appendIfPresent(behaviorLines, 'Volatility', row['Volatility Note']);
    appendIfPresent(behaviorLines, 'Cluster Tendency', row['Cluster Note']);
    appendIfPresent(behaviorLines, 'Quality Bands', row['Quality Bands']);

    const behaviorBlock = behaviorLines.length
      ? String.raw`\n\n** Mining Behavior **\n${behaviorLines.join(String.raw`\n`)}`
      : '';
    const refineryLine = row['Best Refinery'] ? String.raw`\n\nBest Refinery: ${row['Best Refinery']}` : '';
    const statsBlock = String.raw`\n\n** Scanner Data **\n${scannerLines.join(String.raw`\n`)}${behaviorBlock}${refineryLine}`;

    return cleanFlavorText + statsBlock;
  },
} satisfies ItemConfig;
