/**
 * Artifact loader (ADR 002).
 *
 * Applies a pre-generated patch artifact (the output of generateArtifact / the
 * CI/CD pipeline) to the user's local global.ini.  This is the "Load" half of
 * the Extract ? Transform ? Load pipeline; it has no knowledge of upstream APIs
 * or item configs.
 *
 * In Phase 2 this logic will run entirely in the browser using the HTML5 File
 * API instead of Node fs — the interface is intentionally kept generic.
 */

import { findIniKey, readIniFile, writeIniFile } from '../localization/ini-file';
import { getLogger } from '../infrastructure/logger';
import { validateIntegrity } from '../application/use-cases/update-planning';

const logger = getLogger('loader');

export interface ArtifactApplyIssue {
  key: string;
  reason: string;
  type: string;
  label?: string;
}

export interface ArtifactApplyResult {
  updatedCount: number;
  skippedCount: number;
  insertedCount: number;
  changedKeys: string[];
  insertedKeys: string[];
  skippedKeys: string[];
  issues: ArtifactApplyIssue[];
  summary: string;
}

function formatKeySamples(keys: string[], maxKeys: number): string {
  if (keys.length === 0) return 'none';
  const shown = keys.slice(0, maxKeys);
  const suffix = keys.length > maxKeys ? `, ...and ${keys.length - maxKeys} more` : '';
  return `${shown.join(', ')}${suffix}`;
}

export function formatArtifactApplyPreview(
  result: Pick<
    ArtifactApplyResult,
    'updatedCount' | 'insertedCount' | 'skippedCount' | 'issues' | 'changedKeys' | 'insertedKeys' | 'skippedKeys'
  >,
  options: { maxKeys?: number } = {},
): string {
  const maxKeys = options.maxKeys ?? 5;
  return [
    'Preview summary:',
    `  Changed:  ${result.updatedCount} (${formatKeySamples(result.changedKeys, maxKeys)})`,
    `  Inserted: ${result.insertedCount} (${formatKeySamples(result.insertedKeys, maxKeys)})`,
    `  Skipped:  ${result.skippedCount} (${formatKeySamples(result.skippedKeys, maxKeys)})`,
    `  Issues:   ${result.issues.length}`,
  ].join('\n');
}

/**
 * Applies the entries from a patch artifact to global.ini.
 *
 * For each key in `artifact.entries`:
 *  - If the key already exists in the INI file, its value is replaced.
 *  - If the key is absent, it is appended at the end of the file (unless
 *    `skipMissing` is true, which matches the current Phase-1 behaviour where
 *    the INI is considered the source of truth for which keys exist).
 */
export async function applyArtifact(
  artifact: { entries: Record<string, string>; issues?: ArtifactApplyIssue[] },
  iniPath: string,
  options: { dryRun?: boolean; skipBackup?: boolean; skipMissing?: boolean } = {},
): Promise<ArtifactApplyResult> {
  const { dryRun = false, skipBackup = false, skipMissing = true } = options;
  const start = performance.now();

  const { lines, index: existingKeys, lowerCaseIndex } = await readIniFile(iniPath);
  const originalLineCount = lines.length;

  let updatedCount = 0;
  let skippedCount = 0;
  let insertedCount = 0;
  const changedKeys: string[] = [];
  const insertedKeys: string[] = [];
  const skippedKeys: string[] = [];
  const issues: ArtifactApplyIssue[] = [...(artifact.issues ?? [])];
  const newLines = [];

  for (const [artifactKey, newValue] of Object.entries(artifact.entries)) {
    const foundKey = findIniKey(existingKeys, lowerCaseIndex, artifactKey);

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
        changedKeys.push(foundKey);
        logger.debug('Applied patch', { key: foundKey });
      }
    } else if (skipMissing) {
      skippedCount++;
      skippedKeys.push(artifactKey);
      issues.push({ key: artifactKey, reason: 'Key absent from INI; skipped', type: 'missing' });
      logger.debug('Key absent in INI, skipping', { key: artifactKey });
    } else {
      newLines.push(`${artifactKey}=${newValue}`);
      insertedKeys.push(artifactKey);
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

  return { updatedCount, skippedCount, insertedCount, changedKeys, insertedKeys, skippedKeys, issues, summary };
}
