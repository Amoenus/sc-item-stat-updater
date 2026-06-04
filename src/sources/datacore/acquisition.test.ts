import assert from 'node:assert/strict';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreXmlCache } from './acquisition';

test('extractDataCoreXmlCache copies the DCB, runs unforge, cleans temporary files, and counts XML records', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-acquisition-'));
  const sourceDcb = path.join(tmpDir, 'Game.dcb');
  const cacheDir = path.join(tmpDir, 'cache');
  await fs.writeFile(sourceDcb, 'dcb');

  const result = await extractDataCoreXmlCache({
    dcbPath: sourceDcb,
    xmlCacheDir: cacheDir,
    runUnforge: (dir) => {
      assert.equal(dir, cacheDir);
      fsSync.writeFileSync(path.join(dir, 'Game.xml'), '<monolithic />');
      fsSync.mkdirSync(path.join(dir, 'libs', 'foundry'), { recursive: true });
      fsSync.writeFileSync(path.join(dir, 'libs', 'foundry', 'record.xml'), '<record />');
    },
  });

  assert.equal(result.workDcbPath, path.join(cacheDir, 'Game.dcb'));
  assert.equal(result.monolithicXmlPath, path.join(cacheDir, 'Game.xml'));
  assert.equal(result.xmlFileCount, 1);
  await assert.rejects(() => fs.stat(path.join(cacheDir, 'Game.dcb')));
  await assert.rejects(() => fs.stat(path.join(cacheDir, 'Game.xml')));
  assert.equal(await fs.readFile(path.join(cacheDir, 'libs', 'foundry', 'record.xml'), 'utf8'), '<record />');
});

test('extractDataCoreXmlCache can clear an existing cache before extraction', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-acquisition-'));
  const sourceDcb = path.join(tmpDir, 'Game.dcb');
  const cacheDir = path.join(tmpDir, 'cache');
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(sourceDcb, 'dcb');
  await fs.writeFile(path.join(cacheDir, 'old.xml'), '<old />');

  const result = await extractDataCoreXmlCache({
    dcbPath: sourceDcb,
    xmlCacheDir: cacheDir,
    clearExisting: true,
    runUnforge: (dir) => {
      fsSync.writeFileSync(path.join(dir, 'new.xml'), '<new />');
    },
  });

  assert.equal(result.xmlFileCount, 1);
  await assert.rejects(() => fs.stat(path.join(cacheDir, 'old.xml')));
});
