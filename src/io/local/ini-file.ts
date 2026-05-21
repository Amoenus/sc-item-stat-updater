import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { IniKeySuffix } from '../../lib/ini-tags';
import { getLogger } from '../../lib/logger';

const logger = getLogger('ini-file');

/** Appends lineNum to the allOccurrences entry for baseKey, creating the entry on first use. */
function recordOccurrence(baseKey: string, lineNum: number, allOccurrences: Map<string, number[]>): void {
  const existing = allOccurrences.get(baseKey);
  if (existing) {
    existing.push(lineNum);
  } else {
    allOccurrences.set(baseKey, [lineNum]);
  }
}

/**
 * Indexes a variant-suffix key (,P or ,G) under its base name.
 * Always records the line in allOccurrences so all forms are updated together.
 * Only sets index[baseKey] when no base key has been registered yet, keeping
 * the original base form as the canonical lookup entry.
 */
function indexVariantKey(
  key: string,
  lineNum: number,
  index: Record<string, number>,
  allOccurrences: Map<string, number[]>,
): void {
  const baseKey = key.slice(0, key.lastIndexOf(','));
  recordOccurrence(baseKey, lineNum, allOccurrences);
  if (!(baseKey in index)) {
    index[baseKey] = lineNum;
  }
}

/** Records a duplicate key and emits a warning. */
function recordDuplicate(
  key: string,
  lineNum: number,
  index: Record<string, number>,
  duplicates: Map<string, number[]>,
): void {
  if (!duplicates.has(key)) {
    duplicates.set(key, [index[key]]);
  }
  duplicates.get(key)?.push(lineNum);
  logger.warn('Duplicate key detected in INI file', { key, lineNum });
}

/**
 * Reads an INI file using streaming I/O and builds a key index in a single pass.
 * Handles UTF-8 BOM stripping.
 * @param {string} filePath
 * @returns {Promise<{ lines: string[], index: Record<string, number> }>}
 */
export async function readIniFile(filePath: string): Promise<{
  lines: string[];
  index: Record<string, number>;
  duplicates: Map<string, number[]>;
  allOccurrences: Map<string, number[]>;
}> {
  const lines: string[] = [];
  const index: Record<string, number> = {};
  const duplicates = new Map<string, number[]>();
  const allOccurrences = new Map<string, number[]>();

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let lineNum = 0;
  let isFirst = true;

  for await (const rawLine of rl) {
    let line = rawLine;
    if (isFirst) {
      if (line.codePointAt(0) === 0xfeff) line = line.slice(1);
      isFirst = false;
    }

    lines.push(line);
    const eqIdx = line.indexOf('=');
    if (eqIdx > -1) {
      const key = line.substring(0, eqIdx);
      if (key.endsWith(IniKeySuffix.Plural) || key.endsWith(IniKeySuffix.Gendered)) {
        indexVariantKey(key, lineNum, index, allOccurrences);
        lineNum++;
        continue;
      }

      if (key in index) {
        recordDuplicate(key, lineNum, index, duplicates);
      }
      recordOccurrence(key, lineNum, allOccurrences);
      index[key] = lineNum;
    }
    lineNum++;
  }

  return { lines, index, duplicates, allOccurrences };
}

/**
 * Finds a localization key in an INI index using case-insensitive matching.
 *
 * @param {Record<string, number>} index
 * @param {string} targetKey
 * @returns {string | undefined}
 */
export function findIniKey(index: Record<string, number>, targetKey: string): string | undefined {
  if (targetKey in index) {
    return targetKey;
  }

  const targetLower = targetKey.toLowerCase();
  for (const key of Object.keys(index)) {
    if (key.toLowerCase() === targetLower) {
      return key;
    }
  }

  return undefined;
}

const MAX_BACKUPS = 3;

export async function backupIniFile(filePath: string): Promise<void> {
  for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
    const src = `${filePath}.backup.${i}`;
    const dest = `${filePath}.backup.${i + 1}`;
    try {
      await fs.access(src);
      await fs.copyFile(src, dest);
    } catch {
      // Source doesn't exist, skip
    }
  }
  try {
    await fs.access(filePath);
    await fs.copyFile(filePath, `${filePath}.backup.1`);
  } catch {
    // File doesn't exist yet
  }
}

/**
 * Writes lines to an INI file with UTF-8 BOM, rotating up to 3 backups.
 * Uses atomic write (temp file + rename) for crash safety.
 * Falls back to direct overwrite if rename fails (e.g. file locked by editor).
 */
export async function writeIniFile(
  filePath: string,
  lines: string[],
  { skipBackup = false }: { skipBackup?: boolean } = {},
): Promise<void> {
  if (!skipBackup) await backupIniFile(filePath);
  const content = `\ufeff${lines.join('\n')}`;
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, content, 'utf-8');
  try {
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EPERM' || (err as NodeJS.ErrnoException).code === 'EBUSY') {
      await fs.writeFile(filePath, content, 'utf-8');
      await fs.unlink(tmpPath).catch(() => {});
    } else {
      throw err;
    }
  }
}

/**
 * Writes INI lines only when there are changes to persist.
 *
 * @param {string} filePath
 * @param {string[]} lines
 * @param {object} [options]
 * @param {number} [options.updatedCount]
 * @param {boolean} [options.dryRun]
 * @param {boolean} [options.skipBackup]
 * @returns {Promise<boolean>} true when a write was performed
 */
export async function writeIniFileIfChanged(
  filePath: string,
  lines: string[],
  options: { updatedCount?: number; dryRun?: boolean; skipBackup?: boolean } = {},
): Promise<boolean> {
  const { updatedCount = 0, dryRun = false, skipBackup = true } = options;
  if (dryRun || updatedCount <= 0) {
    return false;
  }

  await writeIniFile(filePath, lines, { skipBackup });
  return true;
}
