import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { runComponentTitleUpdate } from './component-titles';

async function makeTempWorkspace() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'component-titles-'));
  const datacoreDir = path.join(dir, 'datacore');
  const scmdbDir = path.join(dir, 'scmdb');
  const iniPath = path.join(dir, 'global.ini');
  await fs.mkdir(datacoreDir);
  await fs.mkdir(scmdbDir);

  await fs.writeFile(
    path.join(datacoreDir, 'miningmodifier.datacore.csv'),
    [
      'Entity Class,Name Key,Description Key,Manufacturer,Size,Grade,Class',
      'mining_modules_active_brandt,item_Mining_Consumable_Brandt,item_Mining_Consumable_Brandt_Desc,MISC,1,A,Industrial',
    ].join('\n'),
    'utf8',
  );
  await fs.writeFile(
    path.join(datacoreDir, 'powerplant.datacore.csv'),
    [
      'Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Power Output',
      'powr_acom_s01_lumacore,item_Name_POWR_ACOM_S01_LumaCore,,item_Desc_POWR_ACOM_S01_LumaCore,ACOM,1,1,Power,140,16',
      'powr_acom_s02_solarflare,item_Name_POWR_ACOM_S02_SolarFlare,,item_Desc_POWR_ACOM_S02_SolarFlare,ACOM,2,1,Power,180,20',
      'powr_aegs_s02_bolide,item_Name_POWR_AEGS_S02_Bolide,,item_Desc_POWR_AEGS_S02_Bolide,AEGS,2,2,UNDEFINED,300,20',
      'powr_misc_s01_unknown,item_Name_POWR_MISC_S01_Unknown,,item_Desc_POWR_MISC_S01_Unknown,MISC,1,1,UNDEFINED,100,10',
    ].join('\n'),
    'utf8',
  );
  await fs.writeFile(
    path.join(datacoreDir, 'cooler.datacore.csv'),
    [
      'Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class',
      'cool_just_s02_snowfall,item_Name_COOL_JUST_S02_Snowfall,,item_Desc_COOL_JUST_S02_Snowfall,JUST,2,2,UNDEFINED',
    ].join('\n'),
    'utf8',
  );
  await fs.writeFile(
    path.join(datacoreDir, 'weapongun.datacore.csv'),
    [
      'Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Damage Alpha',
      'jokr_distortioncannon_s1,item_NameJOKR_DistortionCannon_S1,item_NameJOKR_DistortionCannon_S1_short,item_DescJOKR_DistortionCannon_S1,JOKR,1,1,Gun,550,81',
    ].join('\n'),
    'utf8',
  );
  await fs.writeFile(
    path.join(datacoreDir, 'record-graph.json'),
    JSON.stringify(
      {
        source: 'datacore-record-graph',
        recordCount: 6,
        records: [
          {
            path: 'hauling/cooler_s02_industrial.xml',
            ref: 'hauling-cooler-industrial-ref',
            rootTag: 'Hauling_EntityClasses.HaulingEntityClass_Cooler_S02_Industrial',
            rootType: 'Hauling_EntityClasses',
            entityClass: 'HaulingEntityClass_Cooler_S02_Industrial',
            localizationKeys: [],
            referencedGuids: ['snowfall-ref'],
          },
          {
            path: 'cooler/cool_just_s02_snowfall.xml',
            ref: 'snowfall-ref',
            rootTag: 'EntityClassDefinition.COOL_JUST_S02_Snowfall_SCItem',
            rootType: 'EntityClassDefinition',
            entityClass: 'COOL_JUST_S02_Snowfall_SCItem',
            localizationKeys: [],
            referencedGuids: [],
          },
          {
            path: 'hauling/powerplant_s02_competition.xml',
            ref: 'hauling-competition-ref',
            rootTag: 'Hauling_EntityClasses.HaulingEntityClass_PowerPlant_S02_Competition',
            rootType: 'Hauling_EntityClasses',
            entityClass: 'HaulingEntityClass_PowerPlant_S02_Competition',
            localizationKeys: [],
            referencedGuids: ['solarflare-ref'],
          },
          {
            path: 'power/powr_acom_s02_solarflare.xml',
            ref: 'solarflare-ref',
            rootTag: 'EntityClassDefinition.POWR_ACOM_S02_SolarFlare_SCItem',
            rootType: 'EntityClassDefinition',
            entityClass: 'POWR_ACOM_S02_SolarFlare_SCItem',
            localizationKeys: [],
            referencedGuids: [],
          },
          {
            path: 'hauling/powerplant_s02_military.xml',
            ref: 'hauling-military-ref',
            rootTag: 'Hauling_EntityClasses.HaulingEntityClass_PowerPlant_S02_Military',
            rootType: 'Hauling_EntityClasses',
            entityClass: 'HaulingEntityClass_PowerPlant_S02_Military',
            localizationKeys: [],
            referencedGuids: ['bolide-ref'],
          },
          {
            path: 'power/powr_aegs_s02_bolide.xml',
            ref: 'bolide-ref',
            rootTag: 'EntityClassDefinition.POWR_AEGS_S02_Bolide_SCItem',
            rootType: 'EntityClassDefinition',
            entityClass: 'POWR_AEGS_S02_Bolide_SCItem',
            localizationKeys: [],
            referencedGuids: [],
          },
          {
            path: 'quantumdrive/qdrv_wetk_s02_xl1_scitem.xml',
            ref: 'xl1-ref',
            rootTag: 'EntityClassDefinition.QDRV_WETK_S02_XL1_SCItem',
            rootType: 'EntityClassDefinition',
            entityClass: 'QDRV_WETK_S02_XL1_SCItem',
            localizationKeys: [
              { attribute: 'Name', key: 'item_nameQDRV_WETK_S02_XL1_SCItem' },
              { attribute: 'displayName', key: 'item_name_QDRV_WETK_S02_XL1_Display' },
            ],
            referencedGuids: [],
          },
        ],
        indexes: {
          byRef: {
            'snowfall-ref': 'cooler/cool_just_s02_snowfall.xml',
            'solarflare-ref': 'power/powr_acom_s02_solarflare.xml',
            'bolide-ref': 'power/powr_aegs_s02_bolide.xml',
            'xl1-ref': 'quantumdrive/qdrv_wetk_s02_xl1_scitem.xml',
          },
          byPath: {
            'hauling/cooler_s02_industrial.xml': 0,
            'cooler/cool_just_s02_snowfall.xml': 1,
            'hauling/powerplant_s02_competition.xml': 2,
            'power/powr_acom_s02_solarflare.xml': 3,
            'hauling/powerplant_s02_military.xml': 4,
            'power/powr_aegs_s02_bolide.xml': 5,
            'quantumdrive/qdrv_wetk_s02_xl1_scitem.xml': 6,
          },
          byRootType: {
            Hauling_EntityClasses: [
              'hauling/cooler_s02_industrial.xml',
              'hauling/powerplant_s02_competition.xml',
              'hauling/powerplant_s02_military.xml',
            ],
            EntityClassDefinition: [
              'cooler/cool_just_s02_snowfall.xml',
              'power/powr_acom_s02_solarflare.xml',
              'power/powr_aegs_s02_bolide.xml',
              'quantumdrive/qdrv_wetk_s02_xl1_scitem.xml',
            ],
          },
          byEntityClass: {},
          byLocalizationKey: {},
          byReferencedGuid: {},
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  return { dir, datacoreDir, scmdbDir, iniPath };
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
          'item_Name_POWR_ACOM_S01_LumaCore=LumaCore',
          'item_Name_POWR_ACOM_S02_SolarFlare=SolarFlare',
          'item_Name_POWR_AEGS_S02_Bolide=Bolide',
          'item_Name_POWR_MISC_S01_Unknown=Unknown',
          'item_NameCOOL_JUST_S02_Snowfall=Snowfall',
          'item_Name_COOL_JUST_S02_Snowfall=Snowfall',
          'item_NameJOKR_DistortionCannon_S1=Suckerpunch Cannon',
          'item_NameJOKR_DistortionCannon_S1_short=SCKRPNCH',
          'item_name_unrelated=Brandt',
        ].join('\n'),
        'utf8',
      );

      const result = await runComponentTitleUpdate({ iniPath, datacoreDir, dryRun: false });
      const updated = await fs.readFile(iniPath, 'utf8');

      assert.equal(result.updatedCount, 8);
      assert.equal(result.matchedCount, 7);
      assert.equal(result.scannedCount, 11);
      assert.match(updated, /item_Mining_Consumable_Brandt=Ind\/1\/A Brandt/);
      assert.match(updated, /item_Mining_Consumable_Brandt_red=Ind\/1\/A Brandt Red/);
      assert.match(updated, /item_Name_POWR_ACOM_S01_LumaCore=Cmp\/1\/A LumaCore/);
      assert.match(updated, /item_Name_POWR_ACOM_S02_SolarFlare=Cmp\/2\/A SolarFlare/);
      assert.match(updated, /item_Name_POWR_AEGS_S02_Bolide=Mil\/2\/B Bolide/);
      assert.match(updated, /item_Name_POWR_MISC_S01_Unknown=Unknown/);
      assert.match(updated, /item_NameCOOL_JUST_S02_Snowfall=Ind\/2\/B Snowfall/);
      assert.match(updated, /item_Name_COOL_JUST_S02_Snowfall=Ind\/2\/B Snowfall/);
      assert.match(updated, /item_NameJOKR_DistortionCannon_S1=Gun\/1\/A Suckerpunch Cannon/);
      assert.match(updated, /item_NameJOKR_DistortionCannon_S1_short=SCKRPNCH/);
      assert.match(updated, /item_name_unrelated=Brandt/);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('discovers component CSVs and fills missing component class from SCMDB by DataCore ref', async () => {
    const { dir, datacoreDir, scmdbDir, iniPath } = await makeTempWorkspace();
    try {
      await fs.writeFile(
        path.join(datacoreDir, 'quantumdrive.datacore.csv'),
        [
          'Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health',
          'qdrv_wetk_s02_xl1,item_nameQDRV_WETK_S02_XL1_SCItem,,item_descQDRV_WETK_S02_XL1_SCItem,WETK,2,1,UNDEFINED,840',
        ].join('\n'),
        'utf8',
      );
      await fs.writeFile(
        path.join(scmdbDir, 'crafting_items-test.json'),
        JSON.stringify({
          version: 'test',
          items: [
            {
              entityClass: 'xl1-ref',
              itemType: 'shipcomponent',
              componentClass: 'Military',
            },
          ],
        }),
        'utf8',
      );
      await fs.writeFile(iniPath, 'item_nameQDRV_WETK_S02_XL1_SCItem=XL-1\n', 'utf8');

      const result = await runComponentTitleUpdate({ iniPath, datacoreDir, scmdbDir, dryRun: false });
      const updated = await fs.readFile(iniPath, 'utf8');

      assert.equal(result.updatedCount, 1);
      assert.match(updated, /item_nameQDRV_WETK_S02_XL1_SCItem=Mil\/2\/A XL-1/);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
