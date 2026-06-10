import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { getLogger } from '../infrastructure/logger';
import { IniKeySuffix } from './ini-tags';

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
 *
 * Also produces a `lowerCaseIndex` — a Map from lowercased key to its canonical
 * form — so that {@link findIniKey} can perform case-insensitive lookups in O(1)
 * instead of iterating over all keys on every miss.
 */
export async function readIniFile(filePath: string): Promise<{
  lines: string[];
  index: Record<string, number>;
  lowerCaseIndex: Map<string, string>;
  duplicates: Map<string, number[]>;
  allOccurrences: Map<string, number[]>;
}> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await _readIniFile(filePath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (attempt === 5 || !(code === 'EPERM' || code === 'EBUSY' || code === 'UNKNOWN')) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
    }
  }
  throw new Error('Unreachable');
}

async function _readIniFile(filePath: string): Promise<{
  lines: string[];
  index: Record<string, number>;
  lowerCaseIndex: Map<string, string>;
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

  // Build a lowercase → canonical key map in one pass so findIniKey can do
  // case-insensitive lookups in O(1) instead of scanning all keys on every miss.
  const lowerCaseIndex = new Map<string, string>(Object.keys(index).map((k) => [k.toLowerCase(), k]));

  return { lines, index, lowerCaseIndex, duplicates, allOccurrences };
}

/**
 * Finds a localization key in an INI index using case-insensitive matching.
 *
 * Uses the pre-built `lowerCaseIndex` (lowercase key → canonical key) produced
 * by {@link readIniFile} to perform both lookups in O(1) — first an exact-match
 * check, then a single map lookup on the lowercased target — eliminating the
 * O(n) linear scan that was previously needed for case-insensitive misses.
 */
export function findIniKey(
  index: Record<string, number>,
  lowerCaseIndex: Map<string, string>,
  targetKey: string,
): string | undefined {
  if (targetKey in index) {
    return targetKey;
  }

  return lowerCaseIndex.get(targetKey.toLowerCase());
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
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await fs.rename(tmpPath, filePath);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'EPERM' || code === 'EBUSY' || code === 'UNKNOWN') {
        try {
          await fs.writeFile(filePath, content, 'utf-8');
          await fs.unlink(tmpPath).catch(() => {});
          return;
        } catch (writeErr) {
          const writeCode = (writeErr as NodeJS.ErrnoException).code;
          if (attempt === 5 || !(writeCode === 'EPERM' || writeCode === 'EBUSY' || writeCode === 'UNKNOWN')) {
            throw writeErr;
          }
          await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
        }
      } else {
        throw err;
      }
    }
  }
}

/** Writes INI lines only when there are changes to persist. Returns true when a write was performed. */
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
