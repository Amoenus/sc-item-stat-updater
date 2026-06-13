import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreManufacturers } from './manufacturer-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

test('extractDataCoreManufacturers reads raw manufacturer identity and asset metadata', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-manufacturers-'));
  const manufacturerPath = 'libs/foundry/records/scitemmanufacturer/scitemmanufacturer.aegs.xml';
  await fs.mkdir(path.dirname(path.join(xmlCacheDir, manufacturerPath)), { recursive: true });
  await fs.writeFile(
    path.join(xmlCacheDir, manufacturerPath),
    `
      <SCItemManufacturer.AEGS
        Logo="UI/SharedAssets/ManufacturerLogos/Aegis_256.tif"
        LogoFullColor="ui/textures/logos/logo_corp_aegs_square_color.tif"
        LogoSimplifiedWhite="ui/textures/logos/logo_corp_aegs_square_white.tif"
        Code="AEG"
        DashboardCanvasConfig="3db6a90f-4e32-40b5-b583-da02478b1f69"
        BuildingBlocksStyle="bcf008bc-19c3-4fc5-8629-9f18e462dbe0"
        AudioManufacturerTag="3a4880d2-c4d7-4b78-a5ab-bd9a54fd3e5f"
        LightAmplification="41883412-2a2c-47a0-b5a9-c0f40e3fed63"
        __type="SCItemManufacturer"
        __ref="cf4a74bf-eb2c-462a-9b78-f7f2724c31d2"
        __path="${manufacturerPath}">
        <Localization Name="@manufacturer_NameStale" ShortName="@LOC_EMPTY" Description="@manufacturer_DescStale" />
      </SCItemManufacturer.AEGS>
    `,
    'utf8',
  );

  const rows = await extractDataCoreManufacturers({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph(manufacturerPath)),
  });

  assert.deepEqual(rows, [
    {
      ref: 'cf4a74bf-eb2c-462a-9b78-f7f2724c31d2',
      path: manufacturerPath,
      manufacturerClass: 'AEGS',
      code: 'AEG',
      nameKey: 'manufacturer_NameAEGS',
      shortNameKey: 'manufacturer_ShortNameAEGS',
      descriptionKey: 'manufacturer_DescAEGS',
      logo: 'UI/SharedAssets/ManufacturerLogos/Aegis_256.tif',
      logoFullColor: 'ui/textures/logos/logo_corp_aegs_square_color.tif',
      logoSimplifiedWhite: 'ui/textures/logos/logo_corp_aegs_square_white.tif',
      dashboardCanvasConfigGuid: '3db6a90f-4e32-40b5-b583-da02478b1f69',
      buildingBlocksStyleGuid: 'bcf008bc-19c3-4fc5-8629-9f18e462dbe0',
      audioManufacturerTagGuid: '3a4880d2-c4d7-4b78-a5ab-bd9a54fd3e5f',
      lightAmplificationGuid: '41883412-2a2c-47a0-b5a9-c0f40e3fed63',
    },
  ]);
});

test('extractDataCoreManufacturers ignores placeholder XML fallback keys', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-manufacturers-placeholder-'));
  const manufacturerPath = 'libs/foundry/records/scitemmanufacturer/scitemmanufacturer.placeholder.xml';
  await fs.mkdir(path.dirname(path.join(xmlCacheDir, manufacturerPath)), { recursive: true });
  await fs.writeFile(
    path.join(xmlCacheDir, manufacturerPath),
    `
      <SCItemManufacturer.PLCH
        Code="PLCH"
        __type="SCItemManufacturer"
        __ref="placeholder-manufacturer"
        __path="${manufacturerPath}">
        <Localization Name="@LOC_PLACEHOLDER" ShortName="@LOC_EMPTY" Description="@LOC_UNINITIALIZED" />
      </SCItemManufacturer.PLCH>
    `,
    'utf8',
  );

  const graph = makeGraph(manufacturerPath);
  graph.records[0].ref = 'placeholder-manufacturer';
  graph.records[0].rootTag = 'SCItemManufacturer.PLCH';
  graph.records[0].entityClass = 'PLCH';
  graph.records[0].localizationKeys = [];
  graph.indexes = {
    byRef: { 'placeholder-manufacturer': manufacturerPath },
    byPath: { [manufacturerPath]: 0 },
    byRootType: { SCItemManufacturer: [manufacturerPath] },
    byEntityClass: { PLCH: [manufacturerPath] },
    byLocalizationKey: {},
    byReferencedGuid: {},
  };

  const rows = await extractDataCoreManufacturers({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(graph),
  });

  assert.equal(rows[0].nameKey, '');
  assert.equal(rows[0].shortNameKey, '');
  assert.equal(rows[0].descriptionKey, '');
});

function makeGraph(manufacturerPath: string): DataCoreRecordGraph {
  return {
    source: 'datacore-record-graph',
    recordCount: 1,
    records: [
      {
        path: manufacturerPath,
        ref: 'cf4a74bf-eb2c-462a-9b78-f7f2724c31d2',
        rootTag: 'SCItemManufacturer.AEGS',
        rootType: 'SCItemManufacturer',
        entityClass: 'AEGS',
        localizationKeys: [
          { attribute: 'Description', key: 'manufacturer_DescAEGS' },
          { attribute: 'Name', key: 'manufacturer_NameAEGS' },
          { attribute: 'ShortName', key: 'manufacturer_ShortNameAEGS' },
        ],
        referencedGuids: [],
      },
    ],
    indexes: {
      byRef: {
        'cf4a74bf-eb2c-462a-9b78-f7f2724c31d2': manufacturerPath,
      },
      byPath: {
        [manufacturerPath]: 0,
      },
      byRootType: {
        SCItemManufacturer: [manufacturerPath],
      },
      byEntityClass: {
        AEGS: [manufacturerPath],
      },
      byLocalizationKey: {
        manufacturer_NameAEGS: [manufacturerPath],
        manufacturer_ShortNameAEGS: [manufacturerPath],
        manufacturer_DescAEGS: [manufacturerPath],
      },
      byReferencedGuid: {},
    },
  };
}
