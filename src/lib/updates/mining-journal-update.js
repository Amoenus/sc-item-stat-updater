import path from 'node:path';
import { buildJournalValue } from '../../items/missions/mining-journal.js';
import { readCsvFile } from '../io/csv-parser.js';
import { pathExists } from '../io/discovery.js';
import { readIniFile, writeIniFile } from '../io/ini-file.js';
import { getLogger } from '../logger.js';

const logger = getLogger('mining-journal-update');
const JOURNAL_KEY = 'Journal_General_Mining_Compendium_Content';

/**
 * @param {object} params
 * @param {string} params.iniPath
 * @param {string} params.missionCsvDir
 * @param {boolean} params.dryRun
 * @returns {Promise<null | {label: string, issues: Array<unknown>, summary: string}>}
 */
export async function runMiningJournalUpdate({ iniPath, missionCsvDir, dryRun }) {
  const journalCsvPath = path.join(missionCsvDir, 'mining-journal.csv');

  if (!(await pathExists(journalCsvPath))) {
    return null;
  }

  const start = performance.now();
  const journalRows = await readCsvFile(journalCsvPath);
  const iniData = await Promise.resolve(readIniFile(iniPath));
  const { lines: journalLines, index: journalIdx } = iniData;
  const matchKey = Object.keys(journalIdx).find((key) => key.toLowerCase() === JOURNAL_KEY.toLowerCase());

  if (matchKey === undefined) {
    logger.warn('Mining journal: key not found in INI', { key: JOURNAL_KEY });
    return null;
  }

  const oldLine = journalLines[journalIdx[matchKey]];
  const eqIdx = oldLine.indexOf('=');
  const oldValue = eqIdx > -1 ? oldLine.substring(eqIdx + 1) : '';
  const newValue = buildJournalValue(journalRows, oldValue);
  const updated = newValue !== oldValue;

  if (updated && !dryRun) {
    journalLines[journalIdx[matchKey]] = `${matchKey}=${newValue}`;
    await writeIniFile(iniPath, journalLines, { skipBackup: true });
  }

  const durationMs = Math.round(performance.now() - start);
  logger.info('Mining journal update complete', { updated, durationMs, dryRun });

  return {
    label: 'Mining journal',
    issues: [],
    summary: `Mining journal: Updated ${updated ? 1 : 0}, Matched 1${dryRun ? ' (dry run)' : ''} [${durationMs}ms]`,
  };
}
