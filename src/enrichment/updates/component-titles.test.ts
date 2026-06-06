import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { runComponentTitleUpdate } from './component-titles';

async function makeTempWorkspace() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'component-titles-'));
  const datacoreDir = path.join(dir, 'datacore');
  const iniPath = path.join(dir, 'global.ini');
  await fs.mkdir(datacoreDir);

  await fs.writeFile(
    path.join(datacoreDir, 'miningmodifier.datacore.csv'),
    [
      'Entity Class,Name Key,Description Key,Manufacturer,Size,Grade,Class',
      'mining_modules_active_brandt,item_Mining_Consumable_Brandt,item_Mining_Consumable_Brandt_Desc,MISC,1,A,Industrial',
    ].join('\n'),
    'utf8',
  );

  return { dir, datacoreDir, iniPath };
}

describe('runComponentTitleUpdate', () => {
  it('adds mining title prefixes from DataCore localization keys', async () => {
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
