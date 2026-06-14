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
      'ksar_rifle_energy_01,item_Name_stale_ksar_rifle_energy_01,2,Medium',
      'csv_collision,item_Name_ksar_rifle_energy_01,9,Shotgun',
      'placeholder_weapon,LOC_PLACEHOLDER,9,Shotgun',
      'behr_pistol_ballistic_01,item_Name_behr_pistol_ballistic_01,1,Small',
      'behr_special_case,item_Name_Behr_SpecialCase,3,Energy',
      'rrs_melee_01,item_Namerrs_melee_01,1,Knife',
      'none_special_ballistic_01_tint01,item_Namenone_special_ballistic_01_tint01,5,Large',
      'behr_glauncher_ballistic_01,item_Namebehr_glauncher_ballistic_01,4,Medium',
      'utfl_crossbow_ballistic_01,item_Nameutfl_crossbow_ballistic_01,3,Medium',
      'grin_tractor_01,item_Namegrin_tractor_01,2,Gadget',
    ].join('\n'),
  );
  await fs.writeFile(
    path.join(datacoreDir, 'weaponattachment.datacore.csv'),
    ['Entity Class,Name Key,Size,Class,Slot', 'behr_optics_test,item_Name_behr_optics_test,1,IronSight,Optics'].join(
      '\n',
    ),
  );
  await fs.writeFile(
    path.join(datacoreDir, 'record-graph.json'),
    JSON.stringify({
      source: 'datacore-record-graph',
      recordCount: 6,
      records: [
        {
          path: 'weapons/fps/ksar_rifle_energy_01.xml',
          ref: 'ksar-rifle-ref',
          rootTag: 'EntityClassDefinition.ksar_rifle_energy_01',
          rootType: 'EntityClassDefinition',
          entityClass: 'ksar_rifle_energy_01',
          localizationKeys: [{ attribute: 'Name', key: 'item_Name_ksar_rifle_energy_01' }],
          referencedGuids: [],
        },
        {
          path: 'libs/foundry/records/entities/scitem/weapons/melee/rrs_melee_01.xml',
          ref: 'rrs-melee-ref',
          rootTag: 'EntityClassDefinition.rrs_melee_01',
          rootType: 'EntityClassDefinition',
          entityClass: 'rrs_melee_01',
          localizationKeys: [
            { attribute: 'displayType', key: 'item_displayType_MeleeWeapon' },
            { attribute: 'Name', key: 'item_Namerrs_melee_01' },
          ],
          referencedGuids: [],
        },
        {
          path: 'libs/foundry/records/entities/scitem/weapons/fps_weapons/none_special_ballistic_01_tint01.xml',
          ref: 'none-special-ref',
          rootTag: 'EntityClassDefinition.none_special_ballistic_01_tint01',
          rootType: 'EntityClassDefinition',
          entityClass: 'none_special_ballistic_01_tint01',
          localizationKeys: [
            { attribute: 'displayType', key: 'item_displayType_Shouldered' },
            { attribute: 'Name', key: 'item_Namenone_special_ballistic_01_tint01' },
          ],
          referencedGuids: [],
        },
        {
          path: 'libs/foundry/records/entities/scitem/weapons/fps_weapons/behr_glauncher_ballistic_01.xml',
          ref: 'behr-glauncher-ref',
          rootTag: 'EntityClassDefinition.behr_glauncher_ballistic_01',
          rootType: 'EntityClassDefinition',
          entityClass: 'behr_glauncher_ballistic_01',
          localizationKeys: [
            { attribute: 'displayType', key: 'item_displayType_Special' },
            { attribute: 'Name', key: 'item_Namebehr_glauncher_ballistic_01' },
          ],
          referencedGuids: [],
        },
        {
          path: 'libs/foundry/records/entities/scitem/weapons/fps_weapons/utfl_crossbow_ballistic_01.xml',
          ref: 'utfl-crossbow-ref',
          rootTag: 'EntityClassDefinition.utfl_crossbow_ballistic_01',
          rootType: 'EntityClassDefinition',
          entityClass: 'utfl_crossbow_ballistic_01',
          localizationKeys: [
            { attribute: 'displayType', key: 'item_displayType_Sniper' },
            { attribute: 'Name', key: 'item_Nameutfl_crossbow_ballistic_01' },
          ],
          referencedGuids: [],
        },
        {
          path: 'libs/foundry/records/entities/scitem/weapons/fps_weapons/grin_tractor_01.xml',
          ref: 'grin-tractor-ref',
          rootTag: 'EntityClassDefinition.grin_tractor_01',
          rootType: 'EntityClassDefinition',
          entityClass: 'grin_tractor_01',
          localizationKeys: [
            { attribute: 'displayType', key: 'item_displayType_Rifle' },
            { attribute: 'Name', key: 'item_Namegrin_tractor_01' },
          ],
          referencedGuids: [],
        },
      ],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    'utf8',
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
          'item_Namerrs_melee_01=TBF-4 Combat Knife',
          'item_Namerrs_melee_01_arctic01=TBF-4 Rime Combat Knife',
          'item_Namenone_special_ballistic_01_tint01=Boomtube Ruby Rocket Launcher',
          'item_Namebehr_glauncher_ballistic_01=GP-33 MOD Grenade Launcher',
          'item_Nameutfl_crossbow_ballistic_01=Novian Crossbow',
          'item_Namegrin_tractor_01=MaxLift Tractor Beam',
          'item_name_unrelated=Gallant Rifle',
        ].join('\n'),
      );

      const result = await runFpsTitleTagUpdate({ iniPath, datacoreDir, dryRun: false });
      const updated = await fs.readFile(iniPath, 'utf-8');

      assert.strictEqual(result.updatedCount, 10);
      assert.strictEqual(result.matchedCount, 8);
      assert.strictEqual(result.scannedCount, 11);
      assert.match(updated, /item_Name_ksar_rifle_energy_01=\[S2\|RFL\|ENG\] Gallant Rifle/);
      assert.match(updated, /item_Name_ksar_rifle_energy_01_red=\[S2\|RFL\|ENG\] Gallant Rifle Red/);
      assert.match(updated, /item_Name_behr_optics_test=\[S1\|OPT\] Beacon Sight/);
      assert.match(updated, /item_Name_Behr_SpecialCase=\[S3\|WPN\] Patternless Weapon/);
      assert.match(updated, /item_Namerrs_melee_01=\[S1\|KNF\] TBF-4 Combat Knife/);
      assert.match(updated, /item_Namerrs_melee_01_arctic01=\[S1\|KNF\] TBF-4 Rime Combat Knife/);
      assert.match(updated, /item_Namenone_special_ballistic_01_tint01=\[S5\|SHD\|BAL\] Boomtube Ruby Rocket Launcher/);
      assert.match(updated, /item_Namebehr_glauncher_ballistic_01=\[S4\|GL\|BAL\] GP-33 MOD Grenade Launcher/);
      assert.match(updated, /item_Nameutfl_crossbow_ballistic_01=\[S3\|SNP\|BAL\] Novian Crossbow/);
      assert.match(updated, /item_Namegrin_tractor_01=\[S2\|WPN\] MaxLift Tractor Beam/);
      assert.match(updated, /item_name_unrelated=Gallant Rifle/);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
