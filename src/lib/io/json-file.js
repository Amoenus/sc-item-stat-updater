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
export async function readJsonFile(filePath, label = 'JSON file') {
  const content = await fs.readFile(filePath, 'utf-8');

  try {
    return JSON.parse(content);
  } catch (err) {
    throw new Error(`Invalid ${label}: ${err.message}`);
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
export async function readJsonRelative(importMetaUrl, relativePath, label = relativePath) {
  const moduleDir = path.dirname(fileURLToPath(importMetaUrl));
  const filePath = path.resolve(moduleDir, relativePath);
  return readJsonFile(filePath, label);
}
