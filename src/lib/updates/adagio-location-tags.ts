/**
 * EXPERIMENTAL: Wraps ~mission(location) in <EM4> tags for Adagio salvage
 * description keys that reference a location but don't highlight it.
 *
 * The game engine replaces ~mission(location) at runtime. Adding <EM4> tags
 * around it *may* cause the resolved location name to render highlighted,
 * matching the visual style of other mission description fields such as
 * ~mission(Destination|Address). This is unverified behaviour.
 */
import { readIniFile, writeIniFileIfChanged } from '../../io/local/ini-file';
import { getLogger } from '../logger';
import { buildScannedUpdateResult } from './update-result';

const logger = getLogger('adagio-location-tags-update');

/**
 * Keys whose values contain a bare ~mission(location) that should be wrapped
 * in <EM4> tags. Only exact-case keys are listed; the lookup is case-insensitive
 * via the INI index.
 */
const TARGET_KEYS = [
  'Adagio_BasicSalvage_Desc_01',
  'Adagio_LocateSalvage_Desc_01',
] as const;

/** Matches ~mission(location) not already inside an <EM4> tag. */
const BARE_LOCATION_RE = /(?<!<EM4>)(~mission\(location\))(?!<\/EM4>)/gi;
const TAGGED_REPLACEMENT = '<EM4>$1</EM4>';

export async function runAdagioLocationTagUpdate({ iniPath, dryRun }: { iniPath: string; dryRun: boolean }) {
  const start = performance.now();
  const { lines, index } = await readIniFile(iniPath);

  const issues: Array<{ key: string; reason: string; type: string }> = [];
  let matchedCount = 0;
  let updatedCount = 0;
  const scannedCount = TARGET_KEYS.length;

  for (const targetKey of TARGET_KEYS) {
    // Case-insensitive lookup via lowercased index keys.
    const lowerTarget = targetKey.toLowerCase();
    const matchKey = Object.keys(index).find((k) => k.toLowerCase() === lowerTarget);

    if (matchKey === undefined) {
      issues.push({ key: targetKey, reason: 'Localization key not found', type: 'unresolved' });
      logger.warn('Key not found, skipping', { key: targetKey });
      continue;
    }

    matchedCount++;
    const lineIndex = index[matchKey];
    const currentLine = lines[lineIndex];
    const eqIdx = currentLine.indexOf('=');
    if (eqIdx === -1) continue;

    const currentValue = currentLine.substring(eqIdx + 1);
    const newValue = currentValue.replace(BARE_LOCATION_RE, TAGGED_REPLACEMENT);

    if (newValue === currentValue) {
      logger.debug('No bare ~mission(location) found or already tagged, skipping', { key: matchKey });
      continue;
    }

    lines[lineIndex] = `${matchKey}=${newValue}`;
    updatedCount++;
    logger.info('Tagged ~mission(location) with EM4', { key: matchKey });
  }

  await writeIniFileIfChanged(iniPath, lines, { dryRun, updatedCount, skipBackup: true });

  const durationMs = Math.round(performance.now() - start);
  logger.info('Adagio location tag update complete', {
    updatedCount,
    matchedCount,
    scannedCount,
    issueCount: issues.length,
    dryRun,
    durationMs,
  });

  return buildScannedUpdateResult({
    label: 'Adagio location tags (experimental)',
    updatedCount,
    matchedCount,
    scannedCount,
    issues,
    dryRun,
    durationMs,
  });
}
