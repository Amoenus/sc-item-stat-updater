import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { createInterface } from 'node:readline';

/**
 * Reads an INI file using streaming I/O and builds a key index in a single pass.
 * Handles UTF-8 BOM stripping.
 * @returns {{ lines: string[], index: Record<string, number> }}
 */
export async function readIniFile(filePath) {
  const lines = [];
  const index = {};

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let lineNum = 0;
  let isFirst = true;

  for await (const rawLine of rl) {
    let line = rawLine;
    if (isFirst) {
      if (line.charCodeAt(0) === 0xfeff) line = line.slice(1);
      isFirst = false;
    }

    lines.push(line);
    const eqIdx = line.indexOf('=');
    if (eqIdx > -1) {
      index[line.substring(0, eqIdx)] = lineNum;
    }
    lineNum++;
  }

  return { lines, index };
}

const MAX_BACKUPS = 3;

export async function backupIniFile(filePath) {
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
export async function writeIniFile(filePath, lines, { skipBackup = false } = {}) {
  if (!skipBackup) await backupIniFile(filePath);
  const content = `\ufeff${lines.join('\n')}`;
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, content, 'utf-8');
  try {
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EBUSY') {
      await fs.writeFile(filePath, content, 'utf-8');
      await fs.unlink(tmpPath).catch(() => {});
    } else {
      throw err;
    }
  }
}
