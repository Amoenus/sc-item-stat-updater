import { readCsvFile } from '../../io/local/csv-parser.js';
import { readIniFile, writeIniFileIfChanged } from '../../io/local/ini-file.js';
import { readJsonFile } from '../../io/local/json-file.js';
import { resolveMappingJsonPath, resolveSpviewerCsvPath } from '../../io/local/path-conventions.js';
import { getLogger } from '../logger.js';
import { buildLookupMapFromRows, buildMappedKeyLookup } from './lookup-utils.js';
import { normalizeSpaces } from './title-tag-utils.js';
import { buildScannedUpdateResult } from './update-result.js';

const logger = getLogger('missile-title-tags-update');

const MISSILE_SIGNAL_TAG = {
  CrossSection: 'CS',
  Electromagnetic: 'EM',
  Infrared: 'IR',
};

const MISSILE_KEY_PATTERN = /^(item_nameg?misl_.*?)(_short)?$/i;
const LEADING_TAG_PATTERN = /^\[(CS|EM|IR)\]\s*/i;

async function buildMissileSignalLookup(spviewerDir: string, repoRoot: string) {
  const missileCsvPath = resolveSpviewerCsvPath(spviewerDir, 'missile.spviewer.csv');
  const mappingPath = resolveMappingJsonPath(repoRoot, 'missile.spviewer.json');

  const [rows, mappingData] = await Promise.all([
    readCsvFile(missileCsvPath),
    readJsonFile(mappingPath, 'missile mapping JSON'),
  ]);
  const nameToTag = buildLookupMapFromRows(rows as Iterable<Record<string, string>>, (row) => {
    const name = normalizeSpaces(row.Name || '');
    const signal = normalizeSpaces(row['Tracking Signal'] || '');
    const tag = MISSILE_SIGNAL_TAG[signal as keyof typeof MISSILE_SIGNAL_TAG];
    if (!name || !tag) return null;
    return [name, tag];
  });
  const keyToTag = buildMappedKeyLookup(mappingData as Record<string, string>, nameToTag, (localizationKey) =>
    localizationKey.toLowerCase(),
  );

  return { keyToTag, nameCount: nameToTag.size };
}

function applyMissileSignalTags(lines: string[], keyToTag: Map<string, string>) {
  const updatedLines = [];
  let scannedCount = 0;
  let matchedCount = 0;
  let updatedCount = 0;

  for (const line of lines) {
    const eqIdx = line.indexOf('=');
    if (eqIdx < 0) {
      updatedLines.push(line);
      continue;
    }

    const key = line.substring(0, eqIdx);
    const value = line.substring(eqIdx + 1);
    const keyMatch = MISSILE_KEY_PATTERN.exec(key);
    if (!keyMatch) {
      updatedLines.push(line);
      continue;
    }

    scannedCount++;
    const baseKey = keyMatch[1].toLowerCase();
    const tag = keyToTag.get(baseKey);
    if (!tag) {
      updatedLines.push(line);
      continue;
    }

    matchedCount++;
    const cleanValue = value.replace(LEADING_TAG_PATTERN, '').trimStart();
    const newValue = `[${tag}] ${cleanValue}`;
    if (newValue === value) {
      updatedLines.push(line);
      continue;
    }

    updatedLines.push(`${key}=${newValue}`);
    updatedCount++;
  }

  return { updatedLines, scannedCount, matchedCount, updatedCount };
}

/**
 * @param {object} params
 * @param {string} params.iniPath
 * @param {string} params.spviewerDir
 * @param {string} params.repoRoot
 * @param {boolean} params.dryRun
 */
export async function runMissileTitleTagUpdate({
  iniPath,
  spviewerDir,
  repoRoot,
  dryRun,
}: {
  iniPath: string;
  spviewerDir: string;
  repoRoot: string;
  dryRun: boolean;
}) {
  const start = performance.now();
  const { keyToTag, nameCount } = await buildMissileSignalLookup(spviewerDir, repoRoot);

  logger.info('Loaded missile signal lookup data', {
    localizationKeyCount: keyToTag.size,
    missileNameCount: nameCount,
  });

  const { lines } = await readIniFile(iniPath);
  const { updatedLines, scannedCount, matchedCount, updatedCount } = applyMissileSignalTags(lines, keyToTag);

  await writeIniFileIfChanged(iniPath, updatedLines, { dryRun, updatedCount, skipBackup: true });

  const durationMs = Math.round(performance.now() - start);
  return buildScannedUpdateResult({
    label: 'Missile title tags',
    updatedCount,
    matchedCount,
    scannedCount,
    dryRun,
    durationMs,
  });
}
