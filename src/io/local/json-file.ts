// @ts-check

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Reads and parses a JSON file.
 *
 * @param {string} filePath
 * @param {string} [label]
 * @returns {Promise<any>}
 */
export async function readJsonFile(filePath: string, label = 'JSON file'): Promise<unknown> {
  const content = await fs.readFile(filePath, 'utf-8');

  try {
    return JSON.parse(content);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    throw new Error(`Invalid ${label}: ${error.message}`);
  }
}

/**
 * Reads a JSON file relative to the calling module.
 *
 * @param {string} importMetaUrl
 * @param {string} relativePath
 * @param {string} [label]
 * @returns {Promise<any>}
 */
export async function readJsonRelative(importMetaUrl: string, relativePath: string, label = relativePath): Promise<unknown> {
  const moduleDir = path.dirname(fileURLToPath(importMetaUrl));
  const filePath = path.resolve(moduleDir, relativePath);
  return readJsonFile(filePath, label);
}
