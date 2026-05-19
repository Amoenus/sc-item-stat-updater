import { listMatchingFiles } from '../../io/local/discovery';
import { resolveChildPath } from '../../io/local/path-conventions';

/**
 * Returns sorted SPViewer CSV filenames from a directory.
 *
 * @param {string} spviewerDir
 * @returns {Promise<string[]>}
 */
export async function listSpviewerCsvFiles(spviewerDir: string): Promise<string[]> {
  return listMatchingFiles(spviewerDir, (name) => name.endsWith('.spviewer.csv'), {
    label: 'SPViewer directory',
  });
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
export function buildLookupMapFromRows<V>(
  rows: Iterable<Record<string, string>>,
  buildEntry: (row: Record<string, string>) => null | undefined | readonly [string, V],
): Map<string, V> {
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
export function buildMappedKeyLookup<V>(
  nameToLocalizationKey: Record<string, string>,
  nameLookup: Map<string, V>,
  normalizeKey: (key: string) => string = (key) => key,
): Map<string, V> {
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
export async function buildLookupFromCsvFiles<V>(
  baseDir: string,
  filenames: string[],
  loadEntries: (filePath: string, filename: string) => Promise<Iterable<readonly [string, V]>>,
): Promise<Map<string, V>> {
  const lookup = new Map();
  for (const filename of filenames) {
    const filePath = resolveChildPath(baseDir, filename, 'SPViewer lookup CSV filename');
    const entries = await loadEntries(filePath, filename);
    for (const [key, value] of entries) {
      lookup.set(key, value);
    }
  }
  return lookup;
}
