import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Returns sorted SPViewer CSV filenames from a directory.
 *
 * @param {string} spviewerDir
 * @returns {Promise<string[]>}
 */
export async function listSpviewerCsvFiles(spviewerDir) {
  const entries = await fs.readdir(spviewerDir);
  return entries.filter((name) => name.endsWith('.spviewer.csv')).sort();
}

/**
 * Builds a Map from row data using a row-to-entry projector.
 * Nullish projector results are skipped.
 *
 * @template T
 * @template V
 * @param {Iterable<T>} rows
 * @param {(row: T) => null | undefined | readonly [string, V]} buildEntry
 * @returns {Map<string, V>}
 */
export function buildLookupMapFromRows(rows, buildEntry) {
  const lookup = new Map();
  for (const row of rows) {
    const entry = buildEntry(row);
    if (!entry) {
      continue;
    }
    lookup.set(entry[0], entry[1]);
  }
  return lookup;
}

/**
 * Builds a Map keyed by localization key from a saved name mapping.
 *
 * @template V
 * @param {Record<string, string>} nameToLocalizationKey
 * @param {Map<string, V>} nameLookup
 * @param {(localizationKey: string) => string} [normalizeKey]
 * @returns {Map<string, V>}
 */
export function buildMappedKeyLookup(nameToLocalizationKey, nameLookup, normalizeKey = (key) => key) {
  const lookup = new Map();
  for (const [name, localizationKey] of Object.entries(nameToLocalizationKey)) {
    const value = nameLookup.get(name);
    if (value === undefined) {
      continue;
    }
    lookup.set(normalizeKey(localizationKey), value);
  }
  return lookup;
}

/**
 * Reads multiple CSV files and accumulates a shared lookup.
 *
 * @template V
 * @param {string} baseDir
 * @param {string[]} filenames
 * @param {(filePath: string, filename: string) => Promise<Iterable<readonly [string, V]>>} loadEntries
 * @returns {Promise<Map<string, V>>}
 */
export async function buildLookupFromCsvFiles(baseDir, filenames, loadEntries) {
  const lookup = new Map();
  for (const filename of filenames) {
    const filePath = path.join(baseDir, filename);
    const entries = await loadEntries(filePath, filename);
    for (const [key, value] of entries) {
      lookup.set(key, value);
    }
  }
  return lookup;
}
