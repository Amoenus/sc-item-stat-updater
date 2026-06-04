import type { z } from 'zod';

export const SCMDB_BASE_URL = 'https://scmdb.net/data';
export const SCMDB_VERSIONS_URL = `${SCMDB_BASE_URL}/versions.json`;

export interface ScmdbDataUrls {
  mergedUrl: string;
  miningUrl: string;
  craftingItemsUrl: string;
  craftingBlueprintsUrl: string;
}

export type FetchJson = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
}>;

export function buildScmdbDataUrls(file: string): ScmdbDataUrls {
  const versionFile = file.replace('merged-', '');
  return {
    mergedUrl: `${SCMDB_BASE_URL}/${file}`,
    miningUrl: `${SCMDB_BASE_URL}/mining_data-${versionFile}`,
    craftingItemsUrl: `${SCMDB_BASE_URL}/crafting_items-${versionFile}`,
    craftingBlueprintsUrl: `${SCMDB_BASE_URL}/crafting_blueprints-${versionFile}`,
  };
}

export async function fetchScmdbJson(url: string, fetchJson: FetchJson = fetch): Promise<unknown> {
  const res = await fetchJson(url, { headers: { 'User-Agent': 'SCMDB Scraper' } });
  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

export async function fetchAndValidateScmdbJson<T>(
  url: string,
  schema: z.ZodType<T>,
  fetchJson?: FetchJson,
): Promise<T> {
  const raw = await fetchScmdbJson(url, fetchJson);
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Schema validation failed for ${url}:\n${result.error.toString()}`);
  }
  return result.data;
}
