import { readCsvFile } from '../../io/local/csv-parser';
import { pathExists } from '../../io/local/discovery';
import { findIniKey, readIniFile, writeIniFileIfChanged } from '../../localization/ini-file';
import { resolveMissionCsvPath } from '../../io/local/path-conventions';
import { buildJournalValue, hasRenderableRarityRows, loadDataCoreMiningJournalRows } from '../../items/missions/mining-journal';
import { getLogger } from '../../infrastructure/logger';
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
  datacoreDir,
  dryRun,
}: {
  iniPath: string;
  missionCsvDir: string;
  datacoreDir?: string;
  dryRun: boolean;
}) {
  const journalCsvPath = resolveMissionCsvPath(missionCsvDir, 'mining-journal.csv');
  const datacoreRows = await loadDataCoreMiningJournalRows(datacoreDir);
  const useDatacoreRows = hasRenderableRarityRows(datacoreRows);

  if (!useDatacoreRows && !(await pathExists(journalCsvPath))) {
    return null;
  }

  const start = performance.now();
  const journalRows = useDatacoreRows ? datacoreRows : await readCsvFile(journalCsvPath);
  const iniData = await readIniFile(iniPath);
  const { lines: journalLines, index: journalIdx, lowerCaseIndex: journalLowerIdx } = iniData;
  const matchKey = findIniKey(journalIdx, journalLowerIdx, JOURNAL_KEY);

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
  logger.info('Mining journal update complete', {
    updated,
    source: useDatacoreRows ? 'DataCore-inferred' : 'SCMDB',
    durationMs,
    dryRun,
  });

  return buildScannedUpdateResult({
    label: 'Mining journal',
    updatedCount: updated ? 1 : 0,
    matchedCount: 1,
    scannedCount: 1,
    dryRun,
    durationMs,
  });
}
