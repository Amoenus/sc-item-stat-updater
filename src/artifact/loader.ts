/**
 * Artifact loader (ADR 002).
 *
 * Applies a pre-generated patch artifact (the output of generateArtifact / the
 * CI/CD pipeline) to the user's local global.ini.  This is the "Load" half of
 * the Extract → Transform → Load pipeline; it has no knowledge of upstream APIs
 * or item configs.
 *
 * In Phase 2 this logic will run entirely in the browser using the HTML5 File
 * API instead of Node fs — the interface is intentionally kept generic.
 */

import { findIniKey, readIniFile, writeIniFile } from '../io/local/ini-file';
import { getLogger } from '../lib/logger';
import { validateIntegrity } from '../lib/updater';

const logger = getLogger('loader');

/**
 * Applies the entries from a patch artifact to global.ini.
 *
 * For each key in `artifact.entries`:
 *  - If the key already exists in the INI file, its value is replaced.
 *  - If the key is absent, it is appended at the end of the file (unless
 *    `skipMissing` is true, which matches the current Phase-1 behaviour where
 *    the INI is considered the source of truth for which keys exist).
 *
 * @param {object} artifact - Artifact object (as returned by readArtifactFile)
 * @param {string} iniPath  - Absolute path to global.ini
 * @param {object} [options]
 * @param {boolean} [options.dryRun=false]    - Preview mode: compute changes but do not write
 * @param {boolean} [options.skipBackup=false] - Skip backup rotation before writing
 * @param {boolean} [options.skipMissing=true] - When true, keys absent from the INI are ignored
 *                                               rather than appended. Set to false to allow
 *                                               inserting entirely new keys.
 * @returns {Promise<{
 *   updatedCount: number,
 *   skippedCount: number,
 *   insertedCount: number,
 *   issues: Array,
 *   summary: string,
 * }>}
 */
export async function applyArtifact(
  artifact: { entries: Record<string, string> },
  iniPath: string,
  options: { dryRun?: boolean; skipBackup?: boolean; skipMissing?: boolean } = {},
): Promise<{
  updatedCount: number;
  skippedCount: number;
  insertedCount: number;
  issues: Array<{ key: string; reason: string; type: string }>;
  summary: string;
}> {
  const { dryRun = false, skipBackup = false, skipMissing = true } = options;
  const start = performance.now();

  const { lines, index: existingKeys } = await readIniFile(iniPath);
  const originalLineCount = lines.length;

  let updatedCount = 0;
  let skippedCount = 0;
  let insertedCount = 0;
  const issues = [];
  const newLines = [];

  for (const [artifactKey, newValue] of Object.entries(artifact.entries)) {
    const foundKey = findIniKey(existingKeys, artifactKey);

    if (foundKey) {
      const lineIndex = existingKeys[foundKey];
      const oldLine = lines[lineIndex];
      const eqIdx = oldLine.indexOf('=');
      if (eqIdx === -1) continue;
      const lineKey = oldLine.substring(0, eqIdx);
      const oldValue = oldLine.substring(eqIdx + 1);

      if (newValue !== oldValue) {
        lines[lineIndex] = `${lineKey}=${newValue}`;
        updatedCount++;
        logger.debug('Applied patch', { key: foundKey });
      }
    } else if (skipMissing) {
      skippedCount++;
      issues.push({ key: artifactKey, reason: 'Key absent from INI; skipped', type: 'missing' });
      logger.debug('Key absent in INI, skipping', { key: artifactKey });
    } else {
      newLines.push(`${artifactKey}=${newValue}`);
    }
  }

  // Append brand-new entries (only reached when skipMissing=false).
  if (newLines.length > 0) {
    newLines.sort((a, b) => a.localeCompare(b));
    lines.push(...newLines);
    insertedCount = newLines.length;
  }

  validateIntegrity(originalLineCount, lines);

  const dryRunSuffix = dryRun ? ' (dry run)' : '';
  const summary = `Loader: Updated ${updatedCount}, Inserted ${insertedCount}, Skipped ${skippedCount}${dryRunSuffix} [${Math.round(performance.now() - start)}ms]`;
  logger.debug(summary);

  if (!dryRun && (updatedCount > 0 || insertedCount > 0)) {
    await writeIniFile(iniPath, lines, { skipBackup });
  }

  return { updatedCount, skippedCount, insertedCount, issues, summary };
}
