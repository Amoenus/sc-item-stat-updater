import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readArtifactFile } from './artifact';
import { applyArtifact, formatArtifactApplyPreview } from './loader';

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
  assert.deepEqual(result.changedKeys, ['item_desc_existing']);
  assert.deepEqual(result.insertedKeys, ['item_desc_new']);
  assert.deepEqual(result.skippedKeys, []);
  assert.deepEqual(result.issues, []);
  assert.match(formatArtifactApplyPreview(result), /Changed:\s+1 \(item_desc_existing\)/);
  assert.match(formatArtifactApplyPreview(result), /Inserted:\s+1 \(item_desc_new\)/);
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
  assert.deepEqual(result.changedKeys, ['item_desc_existing']);
  assert.deepEqual(result.insertedKeys, []);
  assert.deepEqual(result.skippedKeys, ['item_desc_missing']);
  assert.deepEqual(result.issues, [
    { key: 'item_desc_missing', reason: 'Key absent from INI; skipped', type: 'missing' },
  ]);
  assert.match(formatArtifactApplyPreview(result), /Skipped:\s+1 \(item_desc_missing\)/);
  assert.match(formatArtifactApplyPreview(result), /Issues:\s+1/);
  assert.equal((await fs.readFile(iniPath, 'utf8')).replace(/^\ufeff/, ''), 'item_desc_existing=Updated value');
});

test('formatArtifactApplyPreview limits representative affected key output', () => {
  const preview = formatArtifactApplyPreview(
    {
      updatedCount: 6,
      insertedCount: 0,
      skippedCount: 0,
      changedKeys: ['key_1', 'key_2', 'key_3', 'key_4', 'key_5', 'key_6'],
      insertedKeys: [],
      skippedKeys: [],
      issues: [],
    },
    { maxKeys: 3 },
  );

  assert.match(preview, /Changed:\s+6 \(key_1, key_2, key_3, \.\.\.and 3 more\)/);
  assert.doesNotMatch(preview, /key_4/);
});
