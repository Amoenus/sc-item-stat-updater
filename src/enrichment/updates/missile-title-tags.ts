import { getLogger } from '../../infrastructure/logger';
import { readCsvFile } from '../../io/local/csv-parser';
import { resolveChildPath } from '../../io/local/path-conventions';
import { readIniFile, writeIniFileIfChanged } from '../../localization/ini-file';
import { getGraphTitleLocalizationKeys, loadOptionalDataCoreRelationshipIndex } from './datacore-title-key-utils';
import { buildLookupMapFromRows } from './lookup-utils';
import { normalizeSpaces } from './title-tag-utils';
import { buildScannedUpdateResult } from './update-result';

const logger = getLogger('missile-title-tags-update');

const DATACORE_MISSILE_CSV = 'missile.datacore.csv';

const MISSILE_SIGNAL_TAG = {
  CrossSection: 'CS',
  Electromagnetic: 'EM',
  Infrared: 'IR',
};

const LEADING_TAG_PATTERN = /^\[(CS|EM|IR)\]\s*/i;

async function buildMissileSignalLookupFromDataCore(datacoreDir: string) {
  const missileCsvPath = resolveChildPath(datacoreDir, DATACORE_MISSILE_CSV, 'DataCore missile CSV filename');
  const [rows, relationships] = await Promise.all([
    readCsvFile(missileCsvPath),
    loadOptionalDataCoreRelationshipIndex(datacoreDir),
  ]);
  const keyToTag = new Map<string, string>();

  for (const row of rows) {
    const signal = normalizeSpaces(row['Tracking Signal'] || '');
    const tag = MISSILE_SIGNAL_TAG[signal as keyof typeof MISSILE_SIGNAL_TAG];
    if (!tag) continue;
    for (const key of getGraphTitleLocalizationKeys(row, relationships)) {
      keyToTag.set(key, tag);
    }
  }

  for (const [key, tag] of buildLookupMapFromRows(rows, (row) => {
    const key = normalizeLocalizationKey(row['Name Key']);
    const signal = normalizeSpaces(row['Tracking Signal'] || '');
    const tag = MISSILE_SIGNAL_TAG[signal as keyof typeof MISSILE_SIGNAL_TAG];
    if (!isUsableLocalizationKey(key) || !tag) return null;
    return [key, tag];
  })) {
    setFallbackLookupValue(keyToTag, key, tag);
  }

  for (const [key, tag] of buildLookupMapFromRows(rows, (row) => {
    const key = normalizeLocalizationKey(row['Short Name Key']);
    const signal = normalizeSpaces(row['Tracking Signal'] || '');
    const tag = MISSILE_SIGNAL_TAG[signal as keyof typeof MISSILE_SIGNAL_TAG];
    if (!isUsableLocalizationKey(key) || !tag) return null;
    return [key, tag];
  })) {
    setFallbackLookupValue(keyToTag, key, tag);
  }

  return keyToTag;
}

function normalizeLocalizationKey(value: unknown): string {
  return normalizeSpaces(value).replace(/^@/, '').toLowerCase();
}

function isUsableLocalizationKey(key: string): boolean {
  return key !== '' && !/^loc_(?:empty|placeholder|uninitialized)$/i.test(key);
}

function setFallbackLookupValue<V>(lookup: Map<string, V>, key: string, value: V): void {
  if (!lookup.has(key)) lookup.set(key, value);
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
    if (!key.toLowerCase().startsWith('item_')) {
      updatedLines.push(line);
      continue;
    }

    scannedCount++;
    const keyLower = normalizeLocalizationKey(key);
    const tag = keyToTag.get(keyLower) ?? keyToTag.get(keyLower.replace(/_short$/i, ''));
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
 * @param {string} params.datacoreDir
 * @param {boolean} params.dryRun
 */
export async function runMissileTitleTagUpdate({
  iniPath,
  datacoreDir,
  dryRun,
}: {
  iniPath: string;
  datacoreDir: string;
  dryRun: boolean;
}) {
  const start = performance.now();
  const keyToTag = await buildMissileSignalLookupFromDataCore(datacoreDir);

  logger.info('Loaded missile signal lookup data', {
    localizationKeyCount: keyToTag.size,
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
