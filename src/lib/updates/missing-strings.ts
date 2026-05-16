import fs from 'node:fs/promises';
import { readIniFile, writeIniFileIfChanged } from '../../io/local/ini-file.js';
import { getLogger } from '../logger.js';
import { buildScannedUpdateResult } from './update-result.js';

const logger = getLogger('missing-strings-update');

/**
 * Reads missing-strings.ini and appends any keys that are absent from global.ini.
 * The patch file uses the same key=value format as global.ini — one entry per line.
 * Keys already present in the target file are skipped (idempotent).
 *
 * @param {object} params
 * @param {string} params.iniPath   - Path to the target global.ini
 * @param {string} params.patchPath - Path to the missing-strings.ini patch file
 * @param {boolean} [params.dryRun]
 * @returns {Promise<{label: string, updatedCount: number, matchedCount: number, scannedCount: number, issues: Array<{key: string, reason: string, type: string}>, summary: string}>}
 */
export async function runMissingStringsUpdate({
  iniPath,
  patchPath,
  dryRun = false,
}: {
  iniPath: string;
  patchPath: string;
  dryRun?: boolean;
}) {
  const start = performance.now();

  try {
    await fs.access(patchPath);
  } catch {
    logger.warn('missing-strings.ini not found, skipping', { patchPath });
    return buildScannedUpdateResult({
      label: 'Missing strings',
      updatedCount: 0,
      matchedCount: 0,
      scannedCount: 0,
      issues: [],
      dryRun,
      durationMs: 0,
    });
  }

  const [{ lines, index }, { lines: patchLines, index: patchIndex }] = await Promise.all([
    readIniFile(iniPath),
    readIniFile(patchPath),
  ]);

  const scannedCount = Object.keys(patchIndex).length;
  let matchedCount = 0;
  let updatedCount = 0;
  const issues: Array<{ key: string; reason: string; type: string }> = [];
  const toAppend = [];

  for (const [patchKey, patchLineNum] of Object.entries(patchIndex)) {
    if (patchKey in index) {
      matchedCount++;
      logger.debug('Key already present in target, skipping', { key: patchKey });
      continue;
    }

    toAppend.push(patchLines[patchLineNum]);
    updatedCount++;
    logger.info('Queued missing string for insertion', { key: patchKey });
  }

  for (const line of toAppend) {
    lines.push(line);
  }

  await writeIniFileIfChanged(iniPath, lines, { dryRun, updatedCount, skipBackup: true });

  const durationMs = Math.round(performance.now() - start);
  logger.info('Missing strings update complete', {
    updatedCount,
    matchedCount,
    scannedCount,
    issueCount: issues.length,
    dryRun,
    durationMs,
  });

  return buildScannedUpdateResult({
    label: 'Missing strings',
    updatedCount,
    matchedCount,
    scannedCount,
    issues,
    dryRun,
    durationMs,
  });
}
