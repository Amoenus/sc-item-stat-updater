import { readCsvFile } from '../../io/local/csv-parser';
import { pathExists } from '../../io/local/discovery';
import { findIniKey, readIniFile, writeIniFileIfChanged } from '../../io/local/ini-file';
import { resolveMissionCsvPath } from '../../io/local/path-conventions';
import { buildJournalValue } from '../../items/missions/mining-journal';
import { getLogger } from '../logger';
import { buildScannedUpdateResult } from './update-result';

const logger = getLogger('mining-journal-update');
const JOURNAL_KEY = 'Journal_General_Mining_Compendium_Content';

/**
 * @param {object} params
 * @param {string} params.iniPath
 * @param {string} params.missionCsvDir
 * @param {boolean} params.dryRun
 * @returns {Promise<null | {
 *   label: string,
 *   updatedCount: number,
 *   matchedCount: number,
 *   scannedCount: number,
 *   issues: Array<unknown>,
 *   summary: string,
 * }>}
 */
export async function runMiningJournalUpdate({
  iniPath,
  missionCsvDir,
  dryRun,
}: {
  iniPath: string;
  missionCsvDir: string;
  dryRun: boolean;
}) {
  const journalCsvPath = resolveMissionCsvPath(missionCsvDir, 'mining-journal.csv');

  if (!(await pathExists(journalCsvPath))) {
    return null;
  }

  const start = performance.now();
  const journalRows = await readCsvFile(journalCsvPath);
  const iniData = await readIniFile(iniPath);
  const { lines: journalLines, index: journalIdx } = iniData;
  const matchKey = findIniKey(journalIdx, JOURNAL_KEY);

  if (matchKey === undefined) {
    logger.warn('Mining journal: key not found in INI', { key: JOURNAL_KEY });
    return null;
  }

  const oldLine = journalLines[journalIdx[matchKey]];
  const eqIdx = oldLine.indexOf('=');
  const oldValue = eqIdx > -1 ? oldLine.substring(eqIdx + 1) : '';
  const newValue = buildJournalValue(journalRows, oldValue);
  const updated = newValue !== oldValue;

  if (updated) {
    const lineKey = eqIdx > -1 ? oldLine.substring(0, eqIdx) : matchKey;
    journalLines[journalIdx[matchKey]] = `${lineKey}=${newValue}`;
  }

  await writeIniFileIfChanged(iniPath, journalLines, { dryRun, updatedCount: updated ? 1 : 0, skipBackup: true });

  const durationMs = Math.round(performance.now() - start);
  logger.info('Mining journal update complete', { updated, durationMs, dryRun });

  return buildScannedUpdateResult({
    label: 'Mining journal',
    updatedCount: updated ? 1 : 0,
    matchedCount: 1,
    scannedCount: 1,
    dryRun,
    durationMs,
  });
}
