import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { runFpsTitleTagUpdate } from './fps-title-tags';

async function makeTempWorkspace() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fps-title-tags-'));
  const datacoreDir = path.join(dir, 'datacore');
  const iniPath = path.join(dir, 'global.ini');
  await fs.mkdir(datacoreDir);

  await fs.writeFile(
    path.join(datacoreDir, 'weaponpersonal.datacore.csv'),
    [
      'Entity Class,Name Key,Size,Class',
      'ksar_rifle_energy_01,item_Name_ksar_rifle_energy_01,2,Medium',
      'behr_pistol_ballistic_01,item_Name_behr_pistol_ballistic_01,1,Small',
      'behr_special_case,item_Name_Behr_SpecialCase,3,Energy',
    ].join('\n'),
  );
  await fs.writeFile(
    path.join(datacoreDir, 'weaponattachment.datacore.csv'),
    ['Entity Class,Name Key,Size,Class,Slot', 'behr_optics_test,item_Name_behr_optics_test,1,IronSight,Optics'].join(
      '\n',
    ),
  );

  return { dir, datacoreDir, iniPath };
}

describe('runFpsTitleTagUpdate', () => {
  it('reports matches without writing when dryRun is enabled', async () => {
    const { dir, datacoreDir, iniPath } = await makeTempWorkspace();
    try {
      const original = 'item_Name_behr_pistol_ballistic_01=P4-AR Rifle';
      await fs.writeFile(iniPath, original);

      const result = await runFpsTitleTagUpdate({ iniPath, datacoreDir, dryRun: true });
      const unchanged = await fs.readFile(iniPath, 'utf-8');

      assert.strictEqual(result.updatedCount, 1);
      assert.strictEqual(result.matchedCount, 1);
      assert.strictEqual(result.scannedCount, 1);
      assert.strictEqual(unchanged, original);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('adds FPS tags from DataCore localization keys', async () => {
    const { dir, datacoreDir, iniPath } = await makeTempWorkspace();
    try {
      await fs.writeFile(
        iniPath,
        [
          'item_Name_ksar_rifle_energy_01=Gallant Rifle',
          'item_Name_ksar_rifle_energy_01_red=Gallant Rifle Red',
          'item_Name_behr_optics_test=Beacon Sight',
          'item_Name_Behr_SpecialCase=Patternless Weapon',
          'item_name_unrelated=Gallant Rifle',
        ].join('\n'),
      );

      const result = await runFpsTitleTagUpdate({ iniPath, datacoreDir, dryRun: false });
      const updated = await fs.readFile(iniPath, 'utf-8');

      assert.strictEqual(result.updatedCount, 4);
      assert.strictEqual(result.matchedCount, 3);
      assert.strictEqual(result.scannedCount, 5);
      assert.match(updated, /item_Name_ksar_rifle_energy_01=\[S2\|RFL\|ENG\] Gallant Rifle/);
      assert.match(updated, /item_Name_ksar_rifle_energy_01_red=\[S2\|RFL\|ENG\] Gallant Rifle Red/);
      assert.match(updated, /item_Name_behr_optics_test=\[S1\|OPT\] Beacon Sight/);
      assert.match(updated, /item_Name_Behr_SpecialCase=\[S3\|WPN\] Patternless Weapon/);
      assert.match(updated, /item_name_unrelated=Gallant Rifle/);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
