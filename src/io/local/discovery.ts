// @ts-check

import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Returns true when a file or directory exists.
 *
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads a directory and returns matching file names (sorted).
 *
 * @param {string} dirPath
 * @param {(name: string) => boolean} isMatch
 * @param {{label?: string, notFoundMessage?: string}} [options]
 * @returns {Promise<string[]>}
 */
export async function listMatchingFiles(
  dirPath: string,
  isMatch: (name: string) => boolean,
  options: { label?: string; notFoundMessage?: string } = {},
): Promise<string[]> {
  const { label = 'Directory', notFoundMessage } = options;

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(notFoundMessage || `${label} not found: ${dirPath}`);
    }
    throw err;
  }

  return entries
    .filter((entry) => entry.isFile() && isMatch(entry.name))
    .map((entry) => entry.name)
    .sort();
}

/**
 * Resolves the latest matching file under a directory.
 *
 * @param {string} dirPath
 * @param {(name: string) => boolean} isMatch
 * @param {{label?: string, notFoundMessage?: string, noMatchMessage?: string}} [options]
 * @returns {Promise<string>}
 */
export async function findLatestMatchingFile(
  dirPath: string,
  isMatch: (name: string) => boolean,
  options: { label?: string; notFoundMessage?: string; noMatchMessage?: string } = {},
): Promise<string> {
  const { label = 'Directory', noMatchMessage } = options;
  const names = await listMatchingFiles(dirPath, isMatch, options);

  if (names.length === 0) {
    throw new Error(noMatchMessage || `No matching files found in ${label}: ${dirPath}`);
  }

  const latestName = names.at(-1);
  if (!latestName) {
    throw new Error(noMatchMessage || `No matching files found in ${label}: ${dirPath}`);
  }

  return path.join(dirPath, latestName);
}

/**
 * Resolves the latest matching subdirectory under a directory.
 *
 * @param {string} dirPath
 * @param {(name: string) => boolean} isMatch
 * @param {{label?: string, notFoundMessage?: string, noMatchMessage?: string}} [options]
 * @returns {Promise<string>}
 */
export async function findLatestMatchingDirectory(
  dirPath: string,
  isMatch: (name: string) => boolean,
  options: { label?: string; notFoundMessage?: string; noMatchMessage?: string } = {},
): Promise<string> {
  const { label = 'Directory', notFoundMessage, noMatchMessage } = options;

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(notFoundMessage || `${label} not found: ${dirPath}`);
    }
    throw err;
  }

  const names = entries
    .filter((entry) => entry.isDirectory() && isMatch(entry.name))
    .map((entry) => entry.name)
    .sort();

  if (names.length === 0) {
    throw new Error(noMatchMessage || `No matching directories found in ${label}: ${dirPath}`);
  }

  const latestName = names.at(-1);
  if (!latestName) {
    throw new Error(noMatchMessage || `No matching directories found in ${label}: ${dirPath}`);
  }

  return path.join(dirPath, latestName);
}
