import { readCsvFile } from '../../io/local/csv-parser.js';
import { readIniFile, writeIniFileIfChanged } from '../../io/local/ini-file.js';
import { getLogger } from '../logger.js';
import { buildLookupFromCsvFiles, listSpviewerCsvFiles } from './lookup-utils.js';
import {
  applyTagToFamily,
  buildVariantFamilyIndex,
  normalizeSpaces,
  parseNameLine,
  resolveBaseFromCurrentValue,
  toVariantFamilyKey,
} from './title-tag-utils.js';
import { buildScannedUpdateResult } from './update-result.js';

const logger = getLogger('component-titles-update');

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

async function buildMiningTitleLookup(spviewerDir: string) {
  const files = await listSpviewerCsvFiles(spviewerDir);
  const nameToPrefix = await buildLookupFromCsvFiles<{ name: string; prefix: string }>(
    spviewerDir,
    files,
    async (filePath: string) => {
      const rows = await readCsvFile(filePath);
      const entries: Array<readonly [string, { name: string; prefix: string }]> = [];
      for (const row of rows) {
        const name = normalizeSpaces(row.Name || '');
        if (!name) continue;
        const cls = (row.Class || '').trim();
        const size = (row.Size || '').trim();
        const grade = (row.Grade || '').trim();
        const prefix = getMiningPrefix(cls, size, grade);
        if (!prefix) continue;
        entries.push([name.toLowerCase(), { name, prefix }]);
      }
      return entries;
    },
  );

  return { files, nameToPrefix };
}

function applyMiningTitlePrefixes(lines: string[], nameToPrefix: Map<string, { name: string; prefix: string }>) {
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
    const base = resolveBaseFromCurrentValue(parsed.value, nameToPrefix);

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
 * @param {string} params.spviewerDir
 * @param {boolean} params.dryRun
 */
export async function runComponentTitleUpdate({
  iniPath,
  spviewerDir,
  dryRun,
}: {
  iniPath: string;
  spviewerDir: string;
  dryRun: boolean;
}) {
  const start = performance.now();
  const { files, nameToPrefix } = await buildMiningTitleLookup(spviewerDir);

  logger.info('Loaded mining title lookup data', {
    csvFileCount: files.length,
    componentCount: nameToPrefix.size,
  });

  const iniData = await readIniFile(iniPath);
  const { lines } = iniData;
  const { updatedLines, scannedCount, matchedCount, updatedCount } = applyMiningTitlePrefixes(lines, nameToPrefix);

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
