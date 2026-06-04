import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, beforeEach, test } from 'node:test';
import type { ItemConfig } from '../../enrichment/item-config';
import { enrichGlobalIni } from './enrich-global-ini';

const tmpDirs: string[] = [];
let tmpDir = '';

const config: ItemConfig = {
  label: 'test-items',
  csvFile: 'items.csv',
  requiredColumns: ['Localization Key', 'Stat'],
  descKeyMatch: (key) => key.endsWith('_desc'),
  buildValue: (row) => `stat: ${row.Stat}`,
};

async function writeFixtures() {
  const csvDir = path.join(tmpDir, 'csv');
  const iniPath = path.join(tmpDir, 'global.ini');
  await fs.mkdir(csvDir, { recursive: true });
  await fs.writeFile(path.join(csvDir, 'items.csv'), 'Localization Key,Stat\nitem_Name,42\n');
  await fs.writeFile(iniPath, 'item_Name=Old Name\nitem_Desc=old stat');
  return { csvDir, iniPath };
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'enrich-global-ini-test-'));
  tmpDirs.push(tmpDir);
});

after(async () => {
  for (const dir of tmpDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('enrichGlobalIni plans and applies updates through the application use case', async () => {
  const { csvDir, iniPath } = await writeFixtures();

  const result = await enrichGlobalIni(config, { csvDir, iniPath, skipBackup: true });
  const updatedIni = await fs.readFile(iniPath, 'utf-8');

  assert.equal(result.updatedCount, 1);
  assert.equal(result.newCount, 0);
  assert.equal(result.patches.item_Desc, 'stat: 42');
  assert.match(result.summary, /^test-items: Updated 1, Added 0, Skipped 0 \[\d+ms]$/);
  assert.equal(updatedIni, '\ufeffitem_Name=Old Name\nitem_Desc=stat: 42');
});

test('enrichGlobalIni creates a repository global.ini backup before writing', async () => {
  const { csvDir, iniPath } = await writeFixtures();
  const originalIni = await fs.readFile(iniPath, 'utf-8');

  await enrichGlobalIni(config, { csvDir, iniPath });

  assert.equal(await fs.readFile(`${iniPath}.backup.1`, 'utf-8'), originalIni);
  assert.equal(await fs.readFile(iniPath, 'utf-8'), '\ufeffitem_Name=Old Name\nitem_Desc=stat: 42');
});

test('enrichGlobalIni dry run returns patches without writing global.ini', async () => {
  const { csvDir, iniPath } = await writeFixtures();

  const result = await enrichGlobalIni(config, { csvDir, iniPath, dryRun: true });
  const iniAfterDryRun = await fs.readFile(iniPath, 'utf-8');

  assert.equal(result.updatedCount, 1);
  assert.equal(result.patches.item_Desc, 'stat: 42');
  assert.match(result.summary, /^test-items: Updated 1, Added 0, Skipped 0 \(dry run\) \[\d+ms]$/);
  assert.equal(iniAfterDryRun, 'item_Name=Old Name\nitem_Desc=old stat');
});
