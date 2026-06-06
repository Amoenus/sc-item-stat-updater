import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inferCategorySourceProvider, resolveLatestVersionDir } from './prepare-update-categories';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'sc-update-categories-'));
}

test('resolveLatestVersionDir selects the latest LIVE directory', async () => {
  const root = await makeTempDir();
  await fs.mkdir(path.join(root, '4.1.0-live.100'));
  await fs.mkdir(path.join(root, '4.2.0-ptu.200'));
  await fs.mkdir(path.join(root, '4.3.0-live.300'));

  const result = await resolveLatestVersionDir(root, false, 'SCMDB', 'scrape-scmdb.js');

  assert.equal(result, path.join(root, '4.3.0-live.300'));
});

test('resolveLatestVersionDir selects the latest PTU directory', async () => {
  const root = await makeTempDir();
  await fs.mkdir(path.join(root, '4.1.0-live.100'));
  await fs.mkdir(path.join(root, '4.2.0-ptu.200'));
  await fs.mkdir(path.join(root, '4.3.0-ptu.300'));

  const result = await resolveLatestVersionDir(root, true, 'DataCore', 'scrape-datacore.js');

  assert.equal(result, path.join(root, '4.3.0-ptu.300'));
});

test('resolveLatestVersionDir reports missing channel with scraper hint', async () => {
  const root = await makeTempDir();
  await fs.mkdir(path.join(root, '4.1.0-live.100'));

  await assert.rejects(
    () => resolveLatestVersionDir(root, true, 'DataCore', 'scrape-datacore.js'),
    /No PTU DataCore version folder found.*scrape-datacore\.js --ptu/,
  );
});

test('inferCategorySourceProvider treats required DataCore companion files as authoritative', () => {
  assert.equal(
    inferCategorySourceProvider(
      {
        label: 'Mining locations',
        csvFile: 'mining-locations.csv',
        sourceFiles: [
          { file: 'mining-provider-presets.datacore.csv', sourceDir: 'datacore' },
          { file: 'mining-compositions.datacore.csv', sourceDir: 'datacore' },
        ],
        loadSourceData: async () => [],
        requiredColumns: [],
        descKeyMatch: () => false,
      },
      'scmdb',
    ),
    'datacore',
  );
});

test('inferCategorySourceProvider keeps optional SCMDB bridge files behind required DataCore files', () => {
  assert.equal(
    inferCategorySourceProvider(
      {
        label: 'Mining element stats',
        csvFile: 'mining-elements.csv',
        sourceFiles: [
          { file: 'mining-elements.csv', sourceDir: 'csvDir', optional: true },
          { file: 'mining-elements.datacore.csv', sourceDir: 'datacore' },
        ],
        loadSourceData: async () => [],
        requiredColumns: [],
        descKeyMatch: () => false,
      },
      'scmdb',
    ),
    'datacore',
  );
});

test('inferCategorySourceProvider leaves SCMDB mission CSV bridges classified as SCMDB', () => {
  assert.equal(
    inferCategorySourceProvider(
      {
        label: 'SCMDB mission descriptions',
        csvFile: 'missions/scmdb-missions.csv',
        requiredColumns: [],
        descKeyMatch: () => false,
      },
      'scmdb',
    ),
    'scmdb',
  );
});
