import fs from 'node:fs/promises';
import { parse } from 'csv-parse/sync';

export function parseCSV(text) {
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
  });
}

/**
 * Reads and parses a CSV file.
 *
 * @param {string} filePath
 * @returns {Promise<Array<Record<string, string>>>}
 */
export async function readCsvFile(filePath) {
  const text = await fs.readFile(filePath, 'utf-8');
  return parseCSV(text);
}
