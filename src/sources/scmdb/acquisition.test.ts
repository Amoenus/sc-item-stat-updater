import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { buildScmdbDataUrls, fetchAndValidateScmdbJson, fetchScmdbJson, SCMDB_BASE_URL } from './acquisition';

test('buildScmdbDataUrls derives SCMDB companion data URLs from a merged file', () => {
  assert.deepEqual(buildScmdbDataUrls('merged-4.8.1-live.11875683.json'), {
    mergedUrl: `${SCMDB_BASE_URL}/merged-4.8.1-live.11875683.json`,
    miningUrl: `${SCMDB_BASE_URL}/mining_data-4.8.1-live.11875683.json`,
    craftingItemsUrl: `${SCMDB_BASE_URL}/crafting_items-4.8.1-live.11875683.json`,
    craftingBlueprintsUrl: `${SCMDB_BASE_URL}/crafting_blueprints-4.8.1-live.11875683.json`,
    memaUrl: `${SCMDB_BASE_URL}/mema-cache.json`,
  });
});

test('fetchScmdbJson sends the SCMDB user agent and returns parsed JSON', async () => {
  const calls: Array<{ url: string; userAgent?: string }> = [];
  const result = await fetchScmdbJson('https://example.test/data.json', async (url, init) => {
    calls.push({ url, userAgent: init?.headers?.['User-Agent'] });
    return response({ ok: true });
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, [{ url: 'https://example.test/data.json', userAgent: 'SCMDB Scraper' }]);
});

test('fetchScmdbJson reports failed HTTP responses clearly', async () => {
  await assert.rejects(
    () => fetchScmdbJson('https://example.test/missing.json', async () => response({}, false, 404, 'Not Found')),
    /Fetch failed 404 Not Found for https:\/\/example\.test\/missing\.json/,
  );
});

test('fetchAndValidateScmdbJson validates successful responses with the supplied schema', async () => {
  const schema = z.object({ version: z.string() });
  const result = await fetchAndValidateScmdbJson('https://example.test/version.json', schema, async () =>
    response({ version: '4.8.1-live.11875683' }),
  );

  assert.deepEqual(result, { version: '4.8.1-live.11875683' });
});

test('fetchAndValidateScmdbJson reports schema failures with the source URL', async () => {
  const schema = z.object({ version: z.string() });
  await assert.rejects(
    () => fetchAndValidateScmdbJson('https://example.test/version.json', schema, async () => response({ version: 42 })),
    /Schema validation failed for https:\/\/example\.test\/version\.json/,
  );
});

function response(data: unknown, ok = true, status = 200, statusText = 'OK') {
  return {
    ok,
    status,
    statusText,
    async json() {
      return data;
    },
  };
}
