import fs from 'node:fs/promises';
import path from 'node:path';
import { getLogger } from '../logger.js';

const logger = getLogger('scmdb-fetcher');

const SCMDB_BASE = 'https://scmdb.net';
const VERSIONS_ENDPOINT = '/data/game-versions.json';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches the current scmdb.net merged.json payload.
 *
 * Reads `/data/game-versions.json` for the live filename, then downloads the
 * referenced `merged-<version>.json`. Caches to `<cacheDir>/<file>` so repeat
 * runs stay offline until the version manifest rolls forward.
 *
 * @param {string} cacheDir - Absolute directory path for cached merged JSON
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh] - Re-download even if cached
 * @param {number} [options.delayMs] - Milliseconds to wait between SCMDB requests
 * @returns {Promise<{ payload: object, version: string, file: string, cachePath: string, fromCache: boolean }>}
 */
export async function fetchMergedData(cacheDir, { forceRefresh = false, delayMs = 0 } = {}) {
  await fs.mkdir(cacheDir, { recursive: true });

  const versionsResp = await fetch(`${SCMDB_BASE}${VERSIONS_ENDPOINT}`);
  if (!versionsResp.ok) {
    throw new Error(`Failed to fetch game-versions.json: ${versionsResp.status} ${versionsResp.statusText}`);
  }
  const versions = await versionsResp.json();
  if (!Array.isArray(versions) || versions.length === 0) {
    throw new Error('game-versions.json is empty or malformed');
  }
  const { version, file } = versions[0];
  if (!version || !file) {
    throw new Error(`game-versions.json missing version/file fields: ${JSON.stringify(versions[0])}`);
  }
  logger.debug('Resolved scmdb version', { version, file });

  const cachePath = path.join(cacheDir, file);
  if (!forceRefresh) {
    try {
      const cached = await fs.readFile(cachePath, 'utf-8');
      logger.debug('Using cached merged.json', { cachePath });
      return { payload: JSON.parse(cached), version, file, cachePath, fromCache: true };
    } catch {
      /* cache miss — fall through to network */
    }
  }

  if (delayMs > 0) {
    logger.debug('Waiting before fetching merged.json', { delayMs });
    await sleep(delayMs);
  }

  const dataResp = await fetch(`${SCMDB_BASE}/data/${file}`);
  if (!dataResp.ok) {
    throw new Error(`Failed to fetch ${file}: ${dataResp.status} ${dataResp.statusText}`);
  }
  const text = await dataResp.text();
  await fs.writeFile(cachePath, text, 'utf-8');
  logger.debug('Cached scmdb merged.json', { cachePath, size: text.length });
  return { payload: JSON.parse(text), version, file, cachePath, fromCache: false };
}
