import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, beforeEach, test } from 'node:test';
import type { ItemConfig } from '../../enrichment/item-config';
import { loadDatacoreConfigs, loadMissionConfigs } from '../../items/registry';
import { buildPatchPlanResult } from './build-patch-plan';

const tmpDirs: string[] = [];
let tmpDir = '';

const legacyConfig: ItemConfig = {
  label: 'Legacy SPViewer items',
  csvFile: 'items.csv',
  nameColumn: 'Name',
  requiredColumns: ['Name', 'Stat'],
  descKeyMatch: (key) => key === 'item_desc_saved',
  buildValue: (row) => `stat: ${row.Stat}`,
};

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'build-patch-plan-test-'));
  tmpDirs.push(tmpDir);
});

after(async () => {
  for (const dir of tmpDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

async function writeLegacyFixtures(mappingContents: string): Promise<{ csvDir: string; iniPath: string }> {
  const csvDir = path.join(tmpDir, 'csv');
  const mappingsDir = path.join(tmpDir, 'mappings');
  const iniPath = path.join(tmpDir, 'global.ini');
  await fs.mkdir(csvDir, { recursive: true });
  await fs.mkdir(mappingsDir, { recursive: true });
  await fs.writeFile(path.join(csvDir, 'items.csv'), 'Name,Stat\nLegacy Cannon,42\n');
  await fs.writeFile(path.join(mappingsDir, 'items.json'), mappingContents);
  await fs.writeFile(iniPath, 'item_Name_saved=Legacy Cannon\nitem_Desc_saved=old stat');
  return { csvDir, iniPath };
}

test('active DataCore and mission configs do not declare legacy SPViewer key-resolution fields', async () => {
  const configs = [...(await loadDatacoreConfigs()).entries(), ...(await loadMissionConfigs()).entries()];

  assert.equal(
    configs.filter(([, config]) => config.nameColumn || config.lookupCsvFile).length,
    0,
    'active categories must not use SPViewer name mappings or lookup CSVs',
  );
});

test('buildPatchPlanResult rejects legacy mapping configs unless explicitly enabled', async () => {
  const { csvDir, iniPath } = await writeLegacyFixtures('{not valid json');

  await assert.rejects(
    buildPatchPlanResult(legacyConfig, { baseDir: tmpDir, csvDir, iniPath, dryRun: true }),
    /Legacy SPViewer key resolution is disabled/,
  );
});

test('buildPatchPlanResult keeps retained legacy mapping resolution behind an explicit option', async () => {
  const { csvDir, iniPath } = await writeLegacyFixtures('{"Legacy Cannon":"item_Name_saved"}');

  const result = await buildPatchPlanResult(legacyConfig, {
    baseDir: tmpDir,
    csvDir,
    iniPath,
    dryRun: true,
    legacyKeyResolution: true,
  });

  assert.equal(result.updatedCount, 1);
  assert.equal(result.unresolvedCount, 0);
  assert.deepEqual(result.plan.entries, [
    {
      key: 'item_Desc_saved',
      value: 'stat: 42',
      source: 'Legacy SPViewer items',
      reason: 'Existing updater patch',
      existingLineIndex: 1,
    },
  ]);
});
