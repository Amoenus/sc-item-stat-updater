import fs from 'node:fs/promises';
import path from 'node:path';
import { getLogger } from '../logger.js';
import { parseCSV } from './csv-parser.js';

const logger = getLogger('mapping-store');

/**
 * Loads a saved mapping file (spviewer name → localization key).
 * Returns an empty map if the file doesn't exist.
 *
 * @param {string} mappingPath - Absolute path to the JSON mapping file
 * @returns {Promise<Map<string, string>>}
 */
export async function loadMappingFile(mappingPath) {
  try {
    const content = await fs.readFile(mappingPath, 'utf-8');
    const obj = JSON.parse(content);
    return new Map(Object.entries(obj));
  } catch (err) {
    if (err.code === 'ENOENT') return new Map();
    logger.debug('Failed to load mapping file, starting fresh', { path: mappingPath, error: err.message });
    return new Map();
  }
}

/**
 * Saves the resolved mapping (spviewer name → localization key) to a JSON file.
 * Creates the parent directory if it doesn't exist.
 *
 * @param {string} mappingPath - Absolute path to the JSON mapping file
 * @param {Map<string, string>} mapping - name → localization key
 */
export async function saveMappingFile(mappingPath, mapping) {
  const sorted = Object.fromEntries([...mapping.entries()].sort(([a], [b]) => a.localeCompare(b)));
  await fs.mkdir(path.dirname(mappingPath), { recursive: true });
  await fs.writeFile(mappingPath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf-8');
}

/**
 * Loads a lookup CSV and builds a map from both its Name and Localization Display Name
 * columns to the Localization Key column.
 *
 * @param {string} csvPath - Absolute path to the lookup CSV
 * @returns {Promise<Map<string, string>>} name/displayName → localizationKey
 */
export async function buildLookupMap(csvPath) {
  const content = await fs.readFile(csvPath, 'utf-8');
  const rows = parseCSV(content);
  const map = new Map();
  for (const row of rows) {
    const locKey = row['Localization Key'];
    if (!locKey || locKey === 'N/A') continue;
    if (row['Name']) map.set(row['Name'], locKey);
    if (row['Localization Display Name']) map.set(row['Localization Display Name'], locKey);
  }
  return map;
}
