import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  collectDataCoreXmlFiles,
  collectDataCoreXmlFilesMatching,
  countDataCoreXmlFiles,
  findDataCoreDcbFile,
} from './xml-files';

test('findDataCoreDcbFile returns a DCB file under LIVE/Data', async () => {
  const root = await makeTempDir();
  const dataDir = path.join(root, 'Data');
  await fs.mkdir(dataDir);
  await fs.writeFile(path.join(dataDir, 'Game2.dcb'), '');

  assert.equal(await findDataCoreDcbFile(root), path.join(dataDir, 'Game2.dcb'));
});

test('findDataCoreDcbFile reports missing Data directory and missing DCB files clearly', async () => {
  const root = await makeTempDir();
  await assert.rejects(() => findDataCoreDcbFile(root), /Could not read LIVE\/Data directory/);

  await fs.mkdir(path.join(root, 'Data'));
  await assert.rejects(() => findDataCoreDcbFile(root), /No \.dcb file found/);
});

test('collectDataCoreXmlFiles recursively collects XML files only', async () => {
  const root = await makeTempDir();
  await fs.mkdir(path.join(root, 'libs', 'foundry'), { recursive: true });
  await fs.writeFile(path.join(root, 'top.xml'), '');
  await fs.writeFile(path.join(root, 'ignore.txt'), '');
  await fs.writeFile(path.join(root, 'libs', 'foundry', 'nested.XML'), '');

  const files = await collectDataCoreXmlFiles(root);

  assert.deepEqual(files.map((file) => path.basename(file)).sort(), ['nested.XML', 'top.xml']);
  assert.equal(await countDataCoreXmlFiles(root), 2);
});

test('collectDataCoreXmlFilesMatching filters by normalized path substring', async () => {
  const root = await makeTempDir();
  const shieldDir = path.join(root, 'libs', 'foundry', 'records', 'entities', 'scitemvehicle', 'shield_generator');
  const weaponDir = path.join(root, 'libs', 'foundry', 'records', 'entities', 'scitemweapon', 'gun');
  await fs.mkdir(shieldDir, { recursive: true });
  await fs.mkdir(weaponDir, { recursive: true });
  await fs.writeFile(path.join(shieldDir, 'shield.xml'), '');
  await fs.writeFile(path.join(weaponDir, 'weapon.xml'), '');

  const matches = await collectDataCoreXmlFilesMatching(root, 'scitemvehicle/shield_generator');

  assert.deepEqual(
    matches.map((file) => path.basename(file)),
    ['shield.xml'],
  );
});

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'sc-datacore-xml-'));
}
