import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { discoverComponentFactCsvFiles, loadDataCoreComponentFacts } from './component-facts';

async function makeTempDataCoreWorkspace() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'component-facts-'));
  const datacoreDir = path.join(dir, 'datacore');
  const scmdbDir = path.join(dir, 'scmdb');
  await fs.mkdir(datacoreDir);
  await fs.mkdir(scmdbDir);

  await fs.writeFile(
    path.join(datacoreDir, 'powerplant.datacore.csv'),
    [
      'Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Power Output',
      'powr_acom_s01_lumacore,item_Name_POWR_ACOM_S01_LumaCore,,item_Desc_POWR_ACOM_S01_LumaCore,ACOM,1,1,Power,140,16',
      'powr_acom_s02_solarflare,item_Name_POWR_ACOM_S02_SolarFlare,,item_Desc_POWR_ACOM_S02_SolarFlare,ACOM,2,1,Power,180,20',
      'powr_aegs_s02_bolide,item_Name_POWR_AEGS_S02_Bolide,,item_Desc_POWR_AEGS_S02_Bolide,AEGS,2,2,UNDEFINED,300,20',
    ].join('\n'),
    'utf8',
  );
  await fs.writeFile(
    path.join(datacoreDir, 'quantumdrive.datacore.csv'),
    [
      'Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health',
      'qdrv_wetk_s02_xl1,item_nameQDRV_WETK_S02_XL1_SCItem,,item_descQDRV_WETK_S02_XL1_Stale_SCItem,WETK,2,1,UNDEFINED,840',
    ].join('\n'),
    'utf8',
  );
  await fs.writeFile(
    path.join(datacoreDir, 'weapongun.datacore.csv'),
    [
      'Entity Class,Name Key,Description Key,Manufacturer,Size,Grade,Class',
      'mgun_test,item_Name_MGun,LOC_UNINITIALIZED,,1,A,Military',
    ].join('\n'),
    'utf8',
  );
  await fs.writeFile(
    path.join(datacoreDir, 'record-graph.json'),
    JSON.stringify(
      {
        source: 'datacore-record-graph',
        recordCount: 7,
        records: [
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
              { attribute: 'Description', key: 'LOC_PLACEHOLDER' },
              { attribute: 'displayDescription', key: 'item_descQDRV_WETK_S02_XL1_SCItem' },
              { attribute: 'displayName', key: 'item_name_QDRV_WETK_S02_XL1_Display' },
            ],
            referencedGuids: [],
          },
          {
            path: 'weapongun/mgun_test.xml',
            ref: 'mgun-ref',
            rootTag: 'EntityClassDefinition.MGun_Test_SCItem',
            rootType: 'EntityClassDefinition',
            entityClass: 'MGun_Test_SCItem',
            localizationKeys: [],
            referencedGuids: ['behr-ref'],
            referencedGuidAttributes: [
              { attribute: 'Manufacturer', value: '' },
              { attribute: 'Manufacturer', value: 'behr-ref' },
            ],
          },
          {
            path: 'manufacturer/behr.xml',
            ref: 'behr-ref',
            rootTag: 'SCItemManufacturer.BEHR',
            rootType: 'SCItemManufacturer',
            entityClass: 'BEHR',
            localizationKeys: [{ attribute: 'Name', key: 'manufacturer_NameBEHR' }],
            referencedGuids: [],
          },
        ],
        indexes: {
          byRef: {
            'solarflare-ref': 'power/powr_acom_s02_solarflare.xml',
            'bolide-ref': 'power/powr_aegs_s02_bolide.xml',
            'xl1-ref': 'quantumdrive/qdrv_wetk_s02_xl1_scitem.xml',
            'mgun-ref': 'weapongun/mgun_test.xml',
            'behr-ref': 'manufacturer/behr.xml',
          },
          byPath: {},
          byRootType: {
            Hauling_EntityClasses: ['hauling/powerplant_s02_competition.xml', 'hauling/powerplant_s02_military.xml'],
            EntityClassDefinition: [
              'power/powr_acom_s02_solarflare.xml',
              'power/powr_aegs_s02_bolide.xml',
              'quantumdrive/qdrv_wetk_s02_xl1_scitem.xml',
              'weapongun/mgun_test.xml',
            ],
            SCItemManufacturer: ['manufacturer/behr.xml'],
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

  return { dir, datacoreDir, scmdbDir };
}

describe('DataCore component facts', () => {
  it('discovers component CSVs while excluding separately tagged item families', async () => {
    const { dir, datacoreDir } = await makeTempDataCoreWorkspace();
    try {
      assert.deepEqual(await discoverComponentFactCsvFiles(datacoreDir), [
        'powerplant.datacore.csv',
        'quantumdrive.datacore.csv',
        'weapongun.datacore.csv',
      ]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('builds typed component facts with class source provenance', async () => {
    const { dir, datacoreDir, scmdbDir } = await makeTempDataCoreWorkspace();
    try {
      await fs.writeFile(
        path.join(scmdbDir, 'crafting_items-test.json'),
        JSON.stringify({
          version: 'test',
          items: [{ entityClass: 'xl1-ref', itemType: 'shipcomponent', componentClass: 'Military' }],
        }),
        'utf8',
      );

      const facts = await loadDataCoreComponentFacts({ datacoreDir, scmdbDir });
      const lumacore = facts.find((fact) => fact.entityClass === 'powr_acom_s01_lumacore');
      const solarflare = facts.find((fact) => fact.entityClass === 'powr_acom_s02_solarflare');
      const bolide = facts.find((fact) => fact.entityClass === 'powr_aegs_s02_bolide');
      const gun = facts.find((fact) => fact.entityClass === 'mgun_test');
      const xl1 = facts.find((fact) => fact.entityClass === 'qdrv_wetk_s02_xl1');

      assert.equal(lumacore?.componentClass, 'Competition');
      assert.equal(lumacore?.componentClassSource, 'datacore-derived');
      assert.equal(lumacore?.stats['Power Output'], '16');
      assert.equal(solarflare?.componentClass, 'Competition');
      assert.equal(solarflare?.componentClassSource, 'datacore-hauling');
      assert.equal(bolide?.componentClass, 'Military');
      assert.equal(bolide?.componentClassSource, 'datacore-hauling');
      assert.equal(gun?.componentClass, 'Military');
      assert.equal(gun?.componentClassSource, 'datacore-attachdef');
      assert.equal(gun?.manufacturerCode, 'BEHR');
      assert.equal(gun?.descriptionKey, '');
      assert.equal(xl1?.componentClass, 'Military');
      assert.equal(xl1?.componentClassSource, 'scmdb-bridge');
      assert.equal(xl1?.descriptionKey, 'item_descqdrv_wetk_s02_xl1_scitem');
      assert.deepEqual(xl1?.titleKeys, [
        'item_nameqdrv_wetk_s02_xl1',
        'item_name_qdrv_wetk_s02_xl1',
        'item_nameqdrv_wetk_s02_xl1_scitem',
        'item_name_qdrv_wetk_s02_xl1_scitem',
        'item_name_qdrv_wetk_s02_xl1_display',
      ]);
      assert.deepEqual(xl1?.titleKeySources, [
        { key: 'item_nameqdrv_wetk_s02_xl1', source: 'csv-name-key' },
        { key: 'item_name_qdrv_wetk_s02_xl1', source: 'csv-name-key' },
        { key: 'item_nameqdrv_wetk_s02_xl1_scitem', source: 'csv-name-key' },
        { key: 'item_name_qdrv_wetk_s02_xl1_scitem', source: 'csv-name-key' },
        { key: 'item_name_qdrv_wetk_s02_xl1_display', source: 'graph-localization' },
        { key: 'item_nameqdrv_wetk_s02_xl1', source: 'graph-localization' },
        { key: 'item_name_qdrv_wetk_s02_xl1', source: 'graph-localization' },
        { key: 'item_nameqdrv_wetk_s02_xl1_scitem', source: 'graph-localization' },
        { key: 'item_name_qdrv_wetk_s02_xl1_scitem', source: 'graph-localization' },
      ]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
