import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { runComponentTitleUpdate } from './component-titles';

async function makeTempWorkspace() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'component-titles-'));
  const spviewerDir = path.join(dir, 'spviewer');
  const datacoreDir = path.join(dir, 'datacore');
  const iniPath = path.join(dir, 'global.ini');
  await fs.mkdir(spviewerDir);
  await fs.mkdir(datacoreDir);

  await fs.writeFile(
    path.join(spviewerDir, 'miningmodifier.spviewer.csv'),
    ['Name,Class,Size,Grade', 'Helix Mining Head,Industrial,1,A'].join('\n'),
    'utf8',
  );
  await fs.writeFile(
    path.join(datacoreDir, 'miningmodifier.datacore.csv'),
    [
      'Entity Class,Name Key,Description Key,Manufacturer,Size,Grade,Class',
      'mining_modules_active_brandt,item_Mining_Consumable_Brandt,item_Mining_Consumable_Brandt_Desc,MISC,1,A,Industrial',
    ].join('\n'),
    'utf8',
  );

  return { dir, spviewerDir, datacoreDir, iniPath };
}

describe('runComponentTitleUpdate', () => {
  it('keeps SPViewer name-based mining title prefixes as legacy fallback', async () => {
    const { dir, spviewerDir, iniPath } = await makeTempWorkspace();
    try {
      await fs.writeFile(
        iniPath,
        ['item_name_mining_head_helix=Helix Mining Head', 'item_name_mining_head_helix_red=Helix Mining Head Red'].join(
          '\n',
        ),
        'utf8',
      );

      const result = await runComponentTitleUpdate({ iniPath, spviewerDir, dryRun: false });
      const updated = await fs.readFile(iniPath, 'utf8');

      assert.equal(result.updatedCount, 2);
      assert.equal(result.matchedCount, 1);
      assert.match(updated, /item_name_mining_head_helix=Ind\/1\/A Helix Mining Head/);
      assert.match(updated, /item_name_mining_head_helix_red=Ind\/1\/A Helix Mining Head Red/);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('adds mining title prefixes from DataCore localization keys without SPViewer CSVs', async () => {
    const { dir, datacoreDir, iniPath } = await makeTempWorkspace();
    try {
      await fs.writeFile(
        iniPath,
        [
          'item_Mining_Consumable_Brandt=Brandt',
          'item_Mining_Consumable_Brandt_red=Brandt Red',
          'item_name_unrelated=Brandt',
        ].join('\n'),
        'utf8',
      );

      const result = await runComponentTitleUpdate({ iniPath, datacoreDir, dryRun: false });
      const updated = await fs.readFile(iniPath, 'utf8');

      assert.equal(result.updatedCount, 2);
      assert.equal(result.matchedCount, 1);
      assert.equal(result.scannedCount, 3);
      assert.match(updated, /item_Mining_Consumable_Brandt=Ind\/1\/A Brandt/);
      assert.match(updated, /item_Mining_Consumable_Brandt_red=Ind\/1\/A Brandt Red/);
      assert.match(updated, /item_name_unrelated=Brandt/);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
