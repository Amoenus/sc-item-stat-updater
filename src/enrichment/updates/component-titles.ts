import { getLogger } from '../../infrastructure/logger';
import { readCsvFile } from '../../io/local/csv-parser';
import { resolveChildPath } from '../../io/local/path-conventions';
import { readIniFile, writeIniFileIfChanged } from '../../localization/ini-file';
import {
  applyTagToFamily,
  buildVariantFamilyIndex,
  normalizeSpaces,
  parseNameLine,
  toVariantFamilyKey,
} from './title-tag-utils';
import { buildScannedUpdateResult } from './update-result';

const logger = getLogger('component-titles-update');

const DATACORE_MINING_MODIFIER_CSV = 'miningmodifier.datacore.csv';

const MINING_CLASS_ABBREV = {
  Stealth: 'Sth',
  Industrial: 'Ind',
  Civilian: 'Civ',
  Competition: 'Cmp',
  Military: 'Mil',
};

function getMiningPrefix(cls: string, size: string, grade: string): string | null {
  if (!cls || !size || !grade) {
    return null;
  }
  const abbr = MINING_CLASS_ABBREV[cls as keyof typeof MINING_CLASS_ABBREV] || cls.slice(0, 3);
  return `${abbr}/${size}/${grade}`;
}

async function buildMiningTitleLookupFromDataCore(datacoreDir: string) {
  const filePath = resolveChildPath(datacoreDir, DATACORE_MINING_MODIFIER_CSV, 'DataCore mining modifier CSV filename');
  const rows = await readCsvFile(filePath);
  const keyToPrefix = new Map<string, { prefix: string }>();

  for (const row of rows) {
    const key = normalizeLocalizationKey(row['Name Key']);
    if (!key) continue;
    const cls = (row.Class || '').trim();
    const size = (row.Size || '').trim();
    const grade = (row.Grade || '').trim();
    const prefix = getMiningPrefix(cls, size, grade);
    if (!prefix) continue;
    keyToPrefix.set(key, { prefix });
  }

  return keyToPrefix;
}

function normalizeLocalizationKey(value: unknown): string {
  return normalizeSpaces(value).replace(/^@/, '').toLowerCase();
}

function applyMiningTitlePrefixes(
  lines: string[],
  keyToPrefix: Map<string, { prefix: string }>,
) {
  const updatedLines = [...lines];
  const familyIndex = buildVariantFamilyIndex(updatedLines);
  const processedFamilies = new Set();

  let scannedCount = 0;
  let matchedCount = 0;
  let updatedCount = 0;

  for (const line of lines) {
    const parsed = parseNameLine(line);
    if (!parsed) {
      continue;
    }

    scannedCount++;
    const base = keyToPrefix.get(normalizeLocalizationKey(parsed.key));

    if (!base) {
      continue;
    }

    matchedCount++;
    const familyKey = toVariantFamilyKey(parsed.key);
    if (processedFamilies.has(familyKey)) {
      continue;
    }

    processedFamilies.add(familyKey);
    updatedCount += applyTagToFamily(
      updatedLines,
      familyIndex,
      familyKey,
      (cleanName: string) => `${base.prefix} ${cleanName}`,
    );
  }

  return { updatedLines, scannedCount, matchedCount, updatedCount };
}

/**
 * @param {object} params
 * @param {string} params.iniPath
 * @param {string} params.datacoreDir
 * @param {boolean} params.dryRun
 */
export async function runComponentTitleUpdate({
  iniPath,
  datacoreDir,
  dryRun,
}: {
  iniPath: string;
  datacoreDir: string;
  dryRun: boolean;
}) {
  const start = performance.now();
  const keyToPrefix = await buildMiningTitleLookupFromDataCore(datacoreDir);

  logger.info('Loaded mining title lookup data', {
    csvFileCount: 1,
    componentCount: keyToPrefix.size,
  });

  const iniData = await readIniFile(iniPath);
  const { lines } = iniData;
  const { updatedLines, scannedCount, matchedCount, updatedCount } = applyMiningTitlePrefixes(lines, keyToPrefix);

  await writeIniFileIfChanged(iniPath, updatedLines, { dryRun, updatedCount, skipBackup: true });

  const durationMs = Math.round(performance.now() - start);
  return buildScannedUpdateResult({
    label: 'Component Titles',
    updatedCount,
    matchedCount,
    scannedCount,
    dryRun,
    durationMs,
  });
}
