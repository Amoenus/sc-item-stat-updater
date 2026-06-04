import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolveLatestVersionDir } from './prepare-update-categories';

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

  const result = await resolveLatestVersionDir(root, true, 'SPViewer', 'scrape-spviewer.js');

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
