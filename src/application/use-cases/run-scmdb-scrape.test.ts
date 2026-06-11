import assert from 'node:assert/strict';
import test from 'node:test';
import { type FetchJson, SCMDB_BASE_URL, SCMDB_VERSIONS_URL } from '../../sources/scmdb/acquisition';
import { runScmdbScrape } from './run-scmdb-scrape';

test('runScmdbScrape selects a version, writes raw SCMDB files, and reports written files', async () => {
  const fetchCalls: string[] = [];
  const madeDirs: string[] = [];
  const writes: Array<{ path: string; content: string }> = [];
  const observedFiles: string[] = [];

  const fetchJson: FetchJson = async (url) => {
    fetchCalls.push(url);
    if (url === SCMDB_VERSIONS_URL) {
      return ok([{ version: '4.8.1-live.1', file: 'merged-4.8.1-live.1.json' }]);
    }
    if (url === `${SCMDB_BASE_URL}/merged-4.8.1-live.1.json`) {
      return ok({ contracts: [], legacyContracts: [], factions: {}, factionRewardsPools: {}, blueprintPools: {} });
    }
    if (url === `${SCMDB_BASE_URL}/mining_data-4.8.1-live.1.json`) {
      return ok({ mineableElements: {}, compositions: {}, locations: [], qualityDistribution: {} });
    }
    if (url === `${SCMDB_BASE_URL}/mema-cache.json`) {
      return ok({});
    }
    return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) };
  };

  const result = await runScmdbScrape({
    repoRoot: 'repo',
    rawOnly: true,
    fetchJson,
    makeDir: async (dir) => {
      madeDirs.push(dir);
    },
    writeTextFile: async (filePath, content) => {
      writes.push({ path: filePath, content });
    },
    onFileWritten: (file) => {
      observedFiles.push(`${file.section}:${file.fileName}`);
    },
  });

  assert.equal(result.selected.version, '4.8.1-live.1');
  assert.deepEqual(fetchCalls, [
    SCMDB_VERSIONS_URL,
    `${SCMDB_BASE_URL}/merged-4.8.1-live.1.json`,
    `${SCMDB_BASE_URL}/mining_data-4.8.1-live.1.json`,
    `${SCMDB_BASE_URL}/crafting_items-4.8.1-live.1.json`,
    `${SCMDB_BASE_URL}/crafting_blueprints-4.8.1-live.1.json`,
    `${SCMDB_BASE_URL}/mema-cache.json`,
  ]);
  assert.deepEqual(observedFiles, [
    'root:merged-4.8.1-live.1.json',
    'root:mining_data-4.8.1-live.1.json',
    'root:mining_data.json',
    'root:mema-cache.json',
  ]);
  assert.deepEqual(
    writes.map((write) => write.path),
    [
      'repo\\csv\\scmdb\\4.8.1-live.1\\merged-4.8.1-live.1.json',
      'repo\\csv\\scmdb\\4.8.1-live.1\\mining_data-4.8.1-live.1.json',
      'repo\\csv\\scmdb\\4.8.1-live.1\\mining_data.json',
      'repo\\csv\\scmdb\\4.8.1-live.1\\mema-cache.json',
    ],
  );
  assert.equal(madeDirs.includes('repo\\csv\\scmdb\\4.8.1-live.1'), true);
  assert.equal(madeDirs.includes('repo\\csv\\scmdb\\4.8.1-live.1\\missions'), true);
});

test('runScmdbScrape forwards explicit version selection failures', async () => {
  await assert.rejects(
    () =>
      runScmdbScrape({
        repoRoot: 'repo',
        version: 'missing',
        rawOnly: true,
        fetchJson: async (url) => {
          assert.equal(url, SCMDB_VERSIONS_URL);
          return ok([{ version: '4.8.1-live.1', file: 'merged-4.8.1-live.1.json' }]);
        },
      }),
    /Version not found: missing/,
  );
});

function ok(value: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => value,
  };
}
