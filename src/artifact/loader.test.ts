import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readArtifactFile } from './artifact';
import { applyArtifact } from './loader';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'sc-artifact-loader-'));
}

test('applyArtifact applies a compact artifact read from disk to an INI fixture', async () => {
  const tempDir = await makeTempDir();
  const artifactPath = path.join(tempDir, 'patch-data.json');
  const iniPath = path.join(tempDir, 'global.ini');

  await fs.writeFile(
    artifactPath,
    JSON.stringify({
      generatedAt: '2026-06-04T00:00:00.000Z',
      scmdbVersion: 'test-scmdb',
      spviewerVersion: null,
      entries: {
        item_desc_existing: 'Updated value',
        item_desc_new: 'Inserted value',
      },
      stats: {
        categoryCount: 1,
        totalEntries: 2,
        totalSkipped: 0,
        totalErrors: 0,
      },
      issues: [],
    }),
    'utf8',
  );
  await fs.writeFile(iniPath, 'item_desc_existing=Old value\nitem_name_existing=Existing', 'utf8');

  const artifact = await readArtifactFile(artifactPath);
  const result = await applyArtifact(artifact, iniPath, { skipBackup: true, skipMissing: false });

  assert.equal(result.updatedCount, 1);
  assert.equal(result.insertedCount, 1);
  assert.equal(result.skippedCount, 0);
  assert.deepEqual(result.issues, []);
  assert.equal(
    (await fs.readFile(iniPath, 'utf8')).replace(/^\ufeff/, ''),
    'item_desc_existing=Updated value\nitem_name_existing=Existing\nitem_desc_new=Inserted value',
  );
});

test('applyArtifact reports absent compact artifact entries when missing keys are skipped', async () => {
  const tempDir = await makeTempDir();
  const iniPath = path.join(tempDir, 'global.ini');
  await fs.writeFile(iniPath, 'item_desc_existing=Old value', 'utf8');

  const result = await applyArtifact(
    { entries: { item_desc_existing: 'Updated value', item_desc_missing: 'Missing value' } },
    iniPath,
    { skipBackup: true },
  );

  assert.equal(result.updatedCount, 1);
  assert.equal(result.insertedCount, 0);
  assert.equal(result.skippedCount, 1);
  assert.deepEqual(result.issues, [
    { key: 'item_desc_missing', reason: 'Key absent from INI; skipped', type: 'missing' },
  ]);
  assert.equal((await fs.readFile(iniPath, 'utf8')).replace(/^\ufeff/, ''), 'item_desc_existing=Updated value');
});
