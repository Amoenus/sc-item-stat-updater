import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DATACORE_TYPE_CONFIG as BOMB_TYPE_CONFIG } from '../../items/datacore/bombs';
import { DATACORE_TYPE_CONFIG as COOLER_TYPE_CONFIG } from '../../items/datacore/coolers';
import { DATACORE_TYPE_CONFIG as EMP_TYPE_CONFIG } from '../../items/datacore/emps';
import { DATACORE_TYPE_CONFIG as JUMP_DRIVE_TYPE_CONFIG } from '../../items/datacore/jump-drives';
import { DATACORE_TYPE_CONFIG as MINING_LASER_TYPE_CONFIG } from '../../items/datacore/mining-lasers';
import { DATACORE_TYPE_CONFIG as MINING_MODIFIER_TYPE_CONFIG } from '../../items/datacore/mining-modifiers';
import { DATACORE_TYPE_CONFIG as MISSILE_LAUNCHER_TYPE_CONFIG } from '../../items/datacore/missile-launchers';
import { DATACORE_TYPE_CONFIG as MISSILE_TYPE_CONFIG } from '../../items/datacore/missiles';
import { DATACORE_TYPE_CONFIG as POWERPLANT_TYPE_CONFIG } from '../../items/datacore/powerplants';
import { DATACORE_TYPE_CONFIG as QED_TYPE_CONFIG } from '../../items/datacore/qeds';
import { DATACORE_TYPE_CONFIG as QUANTUM_DRIVE_TYPE_CONFIG } from '../../items/datacore/quantum-drives';
import { DATACORE_TYPE_CONFIG as RADAR_TYPE_CONFIG } from '../../items/datacore/radars';
import { DATACORE_TYPE_CONFIG as SALVAGE_MODIFIER_TYPE_CONFIG } from '../../items/datacore/salvage-modifiers';
import { DATACORE_TYPE_CONFIG as SELF_DESTRUCT_TYPE_CONFIG } from '../../items/datacore/self-destruct';
import { DATACORE_TYPE_CONFIG as SHIELD_TYPE_CONFIG } from '../../items/datacore/shields';
import { DATACORE_TYPE_CONFIG as THROWABLE_TYPE_CONFIG } from '../../items/datacore/throwables';
import { DATACORE_TYPE_CONFIG as TRACTOR_BEAM_TYPE_CONFIG } from '../../items/datacore/tractor-beams';
import { DATACORE_TYPE_CONFIG as TURRET_TYPE_CONFIG } from '../../items/datacore/turrets';
import { DATACORE_TYPE_CONFIG as WEAPON_ATTACHMENT_TYPE_CONFIG } from '../../items/datacore/weapon-attachments';
import { DATACORE_TYPE_CONFIG as WEAPON_DEFENSIVE_TYPE_CONFIG } from '../../items/datacore/weapon-defensive';
import { DATACORE_TYPE_CONFIG as WEAPON_GUN_TYPE_CONFIG } from '../../items/datacore/weapon-guns';
import { DATACORE_TYPE_CONFIG as WEAPON_PERSONAL_TYPE_CONFIG } from '../../items/datacore/weapon-personal';
import type { DataCoreMiningParamRecord } from '../../sources/datacore/types';
import { DATACORE_RAW_FACTS } from '../catalog/category-listing';
import {
  createDataCoreScrapePlan,
  type DataCoreRawFactStageDescriptor,
  type DataCoreTypeEntry,
  groupDataCoreItemTypeStages,
  groupDataCoreRawFactStages,
  runDatacoreScrape,
} from './run-datacore-scrape';

const typeEntry: DataCoreTypeEntry = {
  name: 'shields',
  csvFile: 'shields.datacore.csv',
  typeConfig: {
    recordFilter: 'shieldgenerator',
    entityClassPrefix: 'shld_',
    nameKeyInfix: 'SHLD_',
    fieldSelectors: {
      Power: 'Power',
      Efficiency: { selector: 'Efficiency', attr: 'value', format: 'percent' },
    },
  },
};

test('DataCore raw fact stage groups preserve application dependency order', () => {
  const stages: DataCoreRawFactStageDescriptor[] = [
    { id: 'contract-generators', title: 'Contract generators' },
    { id: 'contract-generator-intel', title: 'Contract generator intel' },
    { id: 'contract-hauling-summary', title: 'Contract hauling summary' },
    { id: 'mission-contract-intel', title: 'Mission contract intel' },
    { id: 'blueprint-pools', title: 'Blueprint pools' },
    { id: 'crafting-blueprints', title: 'Crafting blueprints' },
  ];

  const groups = groupDataCoreRawFactStages(stages);

  assert.deepEqual(
    groups.map((group) => ({
      title: group.title,
      concurrent: group.concurrent,
      ids: group.stages.map((stage) => stage.id),
    })),
    [
      { title: 'Extract contract source facts', concurrent: true, ids: ['contract-generators'] },
      {
        title: 'Build contract derived facts',
        concurrent: true,
        ids: ['contract-generator-intel', 'contract-hauling-summary'],
      },
      { title: 'Build mission derived facts', concurrent: false, ids: ['mission-contract-intel'] },
      {
        title: 'Extract blueprint and material facts',
        concurrent: true,
        ids: ['blueprint-pools', 'crafting-blueprints'],
      },
    ],
  );
});

test('DataCore stage groups keep unknown future stages in fallback buckets', () => {
  const rawFactGroups = groupDataCoreRawFactStages([
    { id: 'future-raw-fact' as DataCoreRawFactStageDescriptor['id'], title: 'Future raw fact' },
  ]);
  const itemTypeGroups = groupDataCoreItemTypeStages([{ id: 'future-type', title: 'Future type' }]);

  assert.deepEqual(rawFactGroups, [
    {
      title: 'Extract remaining raw facts',
      concurrent: true,
      stages: [{ id: 'future-raw-fact', title: 'Future raw fact' }],
    },
  ]);
  assert.deepEqual(itemTypeGroups, [
    {
      title: 'Other item types',
      stages: [{ id: 'future-type', title: 'Future type' }],
    },
  ]);
});

test('DataCore item type stage groups preserve application display order', () => {
  const groups = groupDataCoreItemTypeStages([
    { id: 'weapon-guns', title: 'weapon-guns' },
    { id: 'coolers', title: 'coolers' },
    { id: 'mining-lasers', title: 'mining-lasers' },
  ]);

  assert.deepEqual(
    groups.map((group) => ({ title: group.title, ids: group.stages.map((stage) => stage.id) })),
    [
      { title: 'Ship systems', ids: ['coolers'] },
      { title: 'Weapons and ordnance', ids: ['weapon-guns'] },
      { title: 'Mining and utility', ids: ['mining-lasers'] },
    ],
  );
});

test('runDatacoreScrape parses cached XML records without writing during dry run', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const xmlPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'shieldgenerator', 'shield.xml');
  const progressEvents: string[] = [];
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(
    xmlPath,
    `
      <EntityClassDefinition.SHLD_Test_SCItem __path="libs/foundry/records/entities/scitem/shieldgenerator/shld_test_scitem.xml">
        <SAttachableComponentParams>
          <AttachDef size="2" grade="b" subtype="CIVILIAN">
            <Manufacturer name="ACME" />
          </AttachDef>
        </SAttachableComponentParams>
        <SHealthComponentParams Health="500" />
        <Power value="42" />
        <Efficiency value="0.875" />
      </EntityClassDefinition.SHLD_Test_SCItem>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    dryRun: true,
    loadTypes: async () => [typeEntry],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    extractContractGenerators: async (options) => {
      options.onProgress?.(1, 3);
      return [];
    },
    onRawFactStart: (slug, total) => progressEvents.push(`start:${slug}:${total}`),
    onRawFactProgress: (slug, current, total) => progressEvents.push(`progress:${slug}:${current}:${total}`),
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.versionTag, '4.8.1-live');
  assert.deepEqual(result.results, [{ type: 'shields', rows: 1, skipped: 0, csvFile: 'shields.datacore.csv' }]);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.rawFactResults.map((entry) => [entry.slug, entry.csvFile, entry.rows]),
    DATACORE_RAW_FACTS.map((entry) => [entry.slug, entry.sourceFiles[0], 0]),
  );
  assert.deepEqual(progressEvents.slice(0, 2), ['start:contract-generators:3', 'progress:contract-generators:1:3']);
  await assert.rejects(() => fs.stat(path.join(repoRoot, 'csv', 'datacore', '4.8.1-live')));
});

test('runDatacoreScrape writes raw component identity keys and capitalized AttachDef stats', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-component-identity-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const xmlPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'shieldgenerator', 'shield.xml');
  const manufacturerPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'scitemmanufacturer', 'aegs.xml');
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.mkdir(path.dirname(manufacturerPath), { recursive: true });
  await fs.writeFile(
    xmlPath,
    `
      <EntityClassDefinition.SHLD_Test_SCItem __path="libs/foundry/records/entities/scitem/shieldgenerator/shld_test_scitem.xml">
        <GraphLocalization
          displayName="@item_A_DisplaySHLD_Graph"
          Name="@item_Z_NameSHLD_Graph"
          ShortName="@item_NameSHLD_Graph_short"
          displayDescription="@item_A_DisplayDescSHLD_Graph"
          Description="@item_Z_DescSHLD_Graph" />
        <GraphRelationships Manufacturer="cf4a74bf-eb2c-462a-9b78-f7f2724c31d2" />
        <SAttachableComponentParams>
          <AttachDef Size="2" Grade="b" SubType="CIVILIAN">
            <Localization Name="@LOC_EMPTY" ShortName="@LOC_EMPTY" Description="@LOC_EMPTY" />
          </AttachDef>
        </SAttachableComponentParams>
        <SHealthComponentParams Health="500" />
        <Power value="42" />
        <Efficiency value="0.875" />
      </EntityClassDefinition.SHLD_Test_SCItem>
    `,
  );
  await fs.writeFile(
    manufacturerPath,
    `
      <SCItemManufacturer.AEGS
        Code="AEGS"
        __type="SCItemManufacturer"
        __ref="cf4a74bf-eb2c-462a-9b78-f7f2724c31d2"
        __path="libs/foundry/records/scitemmanufacturer/aegs.xml">
        <Localization Name="@manufacturer_NameAEGS" Description="@manufacturer_DescAEGS" />
      </SCItemManufacturer.AEGS>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [typeEntry],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
  });

  const csv = await fs.readFile(path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'shields.datacore.csv'), 'utf8');

  assert.deepEqual(result.results, [{ type: 'shields', rows: 1, skipped: 0, csvFile: 'shields.datacore.csv' }]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Power,Efficiency\r?\n/,
  );
  assert.match(
    csv,
    /shld_test,item_Z_NameSHLD_Graph,item_NameSHLD_Graph_short,item_Z_DescSHLD_Graph,AEGS,2,B,Civilian,500,42,87.5%/,
  );
});

test('runDatacoreScrape prefers explicit localization before graph key-shape fallback', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-localization-fallback-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const xmlPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'shieldgenerator', 'shield.xml');
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(
    xmlPath,
    `
      <EntityClassDefinition.SHLD_Test_SCItem __path="libs/foundry/records/entities/scitem/shieldgenerator/shld_test_scitem.xml">
        <GraphLocalization displayType="@item_NameSHLD_GraphFallback" />
        <SAttachableComponentParams>
          <AttachDef Size="2" Grade="b" SubType="CIVILIAN" Manufacturer="ACME">
            <Localization Name="@item_NameSHLD_Explicit" ShortName="@item_NameSHLD_Explicit_short" Description="@item_DescSHLD_Explicit" />
          </AttachDef>
        </SAttachableComponentParams>
        <SHealthComponentParams Health="500" />
        <Power value="42" />
        <Efficiency value="0.875" />
      </EntityClassDefinition.SHLD_Test_SCItem>
    `,
    'utf8',
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [typeEntry],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
  });

  const csv = await fs.readFile(path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'shields.datacore.csv'), 'utf8');

  assert.deepEqual(result.results, [{ type: 'shields', rows: 1, skipped: 0, csvFile: 'shields.datacore.csv' }]);
  assert.match(
    csv,
    /shld_test,item_NameSHLD_Explicit,item_NameSHLD_Explicit_short,item_DescSHLD_Explicit,ACME,2,B,Civilian,500,42,87.5%/,
  );
  assert.doesNotMatch(csv, /item_NameSHLD_GraphFallback/);
});

test('runDatacoreScrape does not use key-shape fallback when explicit localization is placeholder', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-localization-placeholder-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const xmlPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'shieldgenerator', 'shield.xml');
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(
    xmlPath,
    `
      <EntityClassDefinition.SHLD_Test_SCItem __path="libs/foundry/records/entities/scitem/shieldgenerator/shld_test_scitem.xml">
        <GraphLocalization displayType="@item_DescSHLD_PatternFallback" />
        <SAttachableComponentParams>
          <AttachDef Size="2" Grade="b" SubType="CIVILIAN" Manufacturer="ACME">
            <Localization Name="@item_NameSHLD_Explicit" ShortName="@LOC_EMPTY" Description="@LOC_EMPTY" />
          </AttachDef>
        </SAttachableComponentParams>
        <SHealthComponentParams Health="500" />
        <Power value="42" />
        <Efficiency value="0.875" />
      </EntityClassDefinition.SHLD_Test_SCItem>
    `,
    'utf8',
  );

  await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [typeEntry],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
  });

  const csv = await fs.readFile(path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'shields.datacore.csv'), 'utf8');

  assert.match(csv, /shld_test,item_NameSHLD_Explicit,,,ACME,2,B,Civilian,500,42,87.5%/);
  assert.doesNotMatch(csv, /item_DescSHLD_PatternFallback/);
});

test('runDatacoreScrape does not use key-shape fallback when graph localization role is placeholder', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-graph-localization-placeholder-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const xmlPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'shieldgenerator', 'shield.xml');
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(
    xmlPath,
    `
      <EntityClassDefinition.SHLD_Test_SCItem __path="libs/foundry/records/entities/scitem/shieldgenerator/shld_test_scitem.xml">
        <GraphLocalization Description="@LOC_PLACEHOLDER" displayType="@item_DescSHLD_PatternFallback" />
        <SAttachableComponentParams>
          <AttachDef Size="2" Grade="b" SubType="CIVILIAN" Manufacturer="ACME">
            <Localization Name="@item_NameSHLD_Explicit" ShortName="@LOC_EMPTY" />
          </AttachDef>
        </SAttachableComponentParams>
        <SHealthComponentParams Health="500" />
        <Power value="42" />
        <Efficiency value="0.875" />
      </EntityClassDefinition.SHLD_Test_SCItem>
    `,
    'utf8',
  );

  await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [typeEntry],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
  });

  const csv = await fs.readFile(path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'shields.datacore.csv'), 'utf8');

  assert.match(csv, /shld_test,item_NameSHLD_Explicit,,,ACME,2,B,Civilian,500,42,87.5%/);
  assert.doesNotMatch(csv, /item_DescSHLD_PatternFallback/);
});

test('runDatacoreScrape does not use XML manufacturer fallback when graph component manufacturer refs are ambiguous', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-component-ambiguous-manufacturer-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const xmlPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'shieldgenerator', 'shield.xml');
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(
    xmlPath,
    `
      <EntityClassDefinition.SHLD_Ambiguous_SCItem __path="libs/foundry/records/entities/scitem/shieldgenerator/shld_ambiguous_scitem.xml">
        <GraphLocalization Name="@item_NameSHLD_Ambiguous" Description="@item_DescSHLD_Ambiguous" />
        <GraphRelationships Manufacturer="cf4a74bf-eb2c-462a-9b78-f7f2724c31d2" />
        <OtherRelationship Manufacturer="65a5d887-3b21-4046-a718-6912c0c7c3be" />
        <SAttachableComponentParams>
          <AttachDef Size="2" Grade="b" SubType="CIVILIAN" Manufacturer="RSI" />
        </SAttachableComponentParams>
        <SHealthComponentParams Health="500" />
      </EntityClassDefinition.SHLD_Ambiguous_SCItem>
    `,
  );

  await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [typeEntry],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
  });

  const csv = await fs.readFile(path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'shields.datacore.csv'), 'utf8');
  assert.match(csv, /shld_ambiguous,item_NameSHLD_Ambiguous,,item_DescSHLD_Ambiguous,,2,B,Civilian,500,,/);
});

test('runDatacoreScrape treats graph manufacturer alias conflicts as ambiguous', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-component-alias-manufacturer-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const xmlPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'shieldgenerator', 'shield.xml');
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(
    xmlPath,
    `
      <EntityClassDefinition.SHLD_Ambiguous_SCItem __path="libs/foundry/records/entities/scitem/shieldgenerator/shld_ambiguous_scitem.xml">
        <GraphLocalization Name="@item_NameSHLD_Ambiguous" Description="@item_DescSHLD_Ambiguous" />
        <GraphRelationships Manufacturer="cf4a74bf-eb2c-462a-9b78-f7f2724c31d2" manufacturer="65a5d887-3b21-4046-a718-6912c0c7c3be" />
        <SAttachableComponentParams>
          <AttachDef Size="2" Grade="b" SubType="CIVILIAN" Manufacturer="RSI" />
        </SAttachableComponentParams>
        <SHealthComponentParams Health="500" />
      </EntityClassDefinition.SHLD_Ambiguous_SCItem>
    `,
    'utf8',
  );

  await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [typeEntry],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
  });

  const csv = await fs.readFile(path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'shields.datacore.csv'), 'utf8');
  assert.match(csv, /shld_ambiguous,item_NameSHLD_Ambiguous,,item_DescSHLD_Ambiguous,,2,B,Civilian,500,,/);
});

test('runDatacoreScrape discovers selector-matched item records outside legacy path filters', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-structural-discovery-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const xmlPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'new_patch_folder',
    'dynamic_test.xml',
  );
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(
    xmlPath,
    `
      <EntityClassDefinition.Dynamic_Test __path="libs/foundry/records/entities/scitem/new_patch_folder/dynamic_test.xml">
        <SAttachableComponentParams>
          <AttachDef Type="DynamicTest" Size="1" Grade="a" Manufacturer="ACME">
            <Localization Name="@item_NameDynamic_Test" Description="@item_DescDynamic_Test" />
          </AttachDef>
        </SAttachableComponentParams>
        <SHealthComponentParams Health="42" />
        <DynamicPower value="9001" />
      </EntityClassDefinition.Dynamic_Test>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'dynamic-test',
        csvFile: 'dynamic-test.datacore.csv',
        typeConfig: {
          recordFilter: 'libs/foundry/records/entities/scitem/old_patch_folder',
          recordSelector: 'SAttachableComponentParams AttachDef[Type="DynamicTest"]',
          entityClassPrefix: '',
          nameKeyInfix: '',
          fieldSelectors: {
            Power: 'DynamicPower',
          },
        },
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
  });

  const csv = await fs.readFile(
    path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'dynamic-test.datacore.csv'),
    'utf8',
  );

  assert.deepEqual(result.results, [
    { type: 'dynamic-test', rows: 1, skipped: 0, csvFile: 'dynamic-test.datacore.csv' },
  ]);
  assert.match(csv, /dynamic_test,item_NameDynamic_Test,,item_DescDynamic_Test,ACME,1,A,,42,9001/);
});

test('runDatacoreScrape tries all graph reference fallbacks before XML refs', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-reference-fallback-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const mainPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'reference_fallback',
    'referencefallback_main.xml',
  );
  const staleRef = '11111111-1111-4111-8111-111111111111';
  const graphRef = '22222222-2222-4222-8222-222222222222';
  await fs.mkdir(path.dirname(mainPath), { recursive: true });
  await fs.writeFile(
    mainPath,
    `
      <EntityClassDefinition.ReferenceFallback_Main __ref="main-ref" __path="libs/foundry/records/entities/scitem/reference_fallback/referencefallback_main.xml">
        <GraphRelationships fallbackRef="${graphRef}" />
        <SAttachableComponentParams>
          <AttachDef Type="ReferenceFallback" Size="1" Grade="a" Manufacturer="ACME">
            <Localization Name="@item_NameReferenceFallback_Main" Description="@item_DescReferenceFallback_Main" />
          </AttachDef>
        </SAttachableComponentParams>
        <SHealthComponentParams Health="42" />
        <PrimaryRef value="${staleRef}" />
      </EntityClassDefinition.ReferenceFallback_Main>
    `,
    'utf8',
  );
  await writeXml(
    xmlCacheDir,
    'libs/foundry/records/references/stale.xml',
    `<ReferenceRecord.Stale __ref="${staleRef}" __path="libs/foundry/records/references/stale.xml" linkedValue="stale" />`,
  );
  await writeXml(
    xmlCacheDir,
    'libs/foundry/records/references/graph.xml',
    `<ReferenceRecord.Graph __ref="${graphRef}" __path="libs/foundry/records/references/graph.xml" linkedValue="graph" />`,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'reference-fallback',
        csvFile: 'reference-fallback.datacore.csv',
        typeConfig: {
          recordFilter: 'libs/foundry/records/entities/scitem/reference_fallback',
          recordSelector: 'SAttachableComponentParams AttachDef[Type="ReferenceFallback"]',
          entityClassPrefix: '',
          nameKeyInfix: '',
          fieldSelectors: {
            'Linked Value': {
              ref: {
                selector: 'PrimaryRef',
                attr: 'value',
                graphAttribute: 'missingPrimaryRef',
                fallback: {
                  selector: 'FallbackRef',
                  attr: 'value',
                  graphAttribute: 'fallbackRef',
                },
              },
              selector: ':root',
              attr: 'linkedValue',
            },
          },
        },
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
  });

  const csv = await fs.readFile(
    path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'reference-fallback.datacore.csv'),
    'utf8',
  );

  assert.deepEqual(result.results, [
    { type: 'reference-fallback', rows: 1, skipped: 0, csvFile: 'reference-fallback.datacore.csv' },
  ]);
  assert.match(
    csv,
    /referencefallback_main,item_NameReferenceFallback_Main,,item_DescReferenceFallback_Main,ACME,1,A,,42,graph/,
  );
  assert.doesNotMatch(csv, /stale/);
});

test('runDatacoreScrape uses selector attr as the default graph reference attribute', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-reference-default-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const mainRecordPath = 'libs/foundry/records/entities/scitem/reference_default/reference_default_main.xml';
  const staleRef = '11111111-1111-4111-8111-111111111111';
  const graphRef = '22222222-2222-4222-8222-222222222222';
  await writeXml(
    xmlCacheDir,
    mainRecordPath,
    `
      <EntityClassDefinition.ReferenceDefault_Main __ref="main-ref" __path="${mainRecordPath}">
        <SAttachableComponentParams>
          <AttachDef Type="ReferenceDefault" Size="1" Grade="a" Manufacturer="ACME">
            <Localization Name="@item_NameReferenceDefault_Main" Description="@item_DescReferenceDefault_Main" />
          </AttachDef>
        </SAttachableComponentParams>
        <SHealthComponentParams Health="42" />
        <PrimaryRef value="${staleRef}" />
      </EntityClassDefinition.ReferenceDefault_Main>
    `,
  );
  await writeXml(
    xmlCacheDir,
    'libs/foundry/records/references/stale-default.xml',
    `<ReferenceRecord.Stale __ref="${staleRef}" __path="libs/foundry/records/references/stale-default.xml" linkedValue="stale" />`,
  );
  await writeXml(
    xmlCacheDir,
    'libs/foundry/records/references/graph-default.xml',
    `<ReferenceRecord.Graph __ref="${graphRef}" __path="libs/foundry/records/references/graph-default.xml" linkedValue="graph" />`,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'reference-default',
        csvFile: 'reference-default.datacore.csv',
        typeConfig: {
          recordFilter: 'libs/foundry/records/entities/scitem/reference_default',
          recordSelector: 'SAttachableComponentParams AttachDef[Type="ReferenceDefault"]',
          entityClassPrefix: '',
          nameKeyInfix: '',
          fieldSelectors: {
            'Linked Value': {
              ref: {
                selector: 'PrimaryRef',
                attr: 'value',
              },
              selector: ':root',
              attr: 'linkedValue',
            },
          },
        },
      },
    ],
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 3,
      records: [
        {
          path: mainRecordPath,
          ref: 'main-ref',
          rootTag: 'EntityClassDefinition.ReferenceDefault_Main',
          rootType: 'EntityClassDefinition',
          entityClass: 'reference_default_main',
          localizationKeys: [
            { attribute: 'Name', key: 'item_NameReferenceDefault_Main' },
            { attribute: 'Description', key: 'item_DescReferenceDefault_Main' },
          ],
          referencedGuids: [graphRef],
          referencedGuidAttributes: [{ attribute: 'value', value: graphRef }],
        },
        {
          path: 'libs/foundry/records/references/stale-default.xml',
          ref: staleRef,
          rootTag: 'ReferenceRecord.Stale',
          rootType: 'ReferenceRecord',
          entityClass: 'Stale',
          localizationKeys: [],
          referencedGuids: [],
        },
        {
          path: 'libs/foundry/records/references/graph-default.xml',
          ref: graphRef,
          rootTag: 'ReferenceRecord.Graph',
          rootType: 'ReferenceRecord',
          entityClass: 'Graph',
          localizationKeys: [],
          referencedGuids: [],
        },
      ],
      indexes: {
        byRef: {
          'main-ref': mainRecordPath,
          [staleRef]: 'libs/foundry/records/references/stale-default.xml',
          [graphRef]: 'libs/foundry/records/references/graph-default.xml',
        },
        byPath: {
          [mainRecordPath]: 0,
          'libs/foundry/records/references/stale-default.xml': 1,
          'libs/foundry/records/references/graph-default.xml': 2,
        },
        byRootType: {
          EntityClassDefinition: [mainRecordPath],
          ReferenceRecord: [
            'libs/foundry/records/references/stale-default.xml',
            'libs/foundry/records/references/graph-default.xml',
          ],
        },
        byEntityClass: {
          reference_default_main: [mainRecordPath],
          Stale: ['libs/foundry/records/references/stale-default.xml'],
          Graph: ['libs/foundry/records/references/graph-default.xml'],
        },
        byLocalizationKey: {},
        byReferencedGuid: {
          [graphRef]: [mainRecordPath],
        },
      },
    }),
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
  });

  const csv = await fs.readFile(
    path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'reference-default.datacore.csv'),
    'utf8',
  );

  assert.deepEqual(result.results, [
    { type: 'reference-default', rows: 1, skipped: 0, csvFile: 'reference-default.datacore.csv' },
  ]);
  assert.match(
    csv,
    /reference_default_main,item_NameReferenceDefault_Main,,item_DescReferenceDefault_Main,ACME,1,A,,42,graph/,
  );
  assert.doesNotMatch(csv, /stale/);
});

test('runDatacoreScrape does not use XML reference fallback when graph selector refs are ambiguous', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-reference-ambiguous-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const mainRecordPath = 'libs/foundry/records/entities/scitem/reference_ambiguous/reference_ambiguous_main.xml';
  const staleRef = '11111111-1111-4111-8111-111111111111';
  const graphRef = '22222222-2222-4222-8222-222222222222';
  const otherGraphRef = '33333333-3333-4333-8333-333333333333';
  await writeXml(
    xmlCacheDir,
    mainRecordPath,
    `
      <EntityClassDefinition.ReferenceAmbiguous_Main __ref="main-ref" __path="${mainRecordPath}">
        <SAttachableComponentParams>
          <AttachDef Type="ReferenceAmbiguous" Size="1" Grade="a" Manufacturer="ACME">
            <Localization Name="@item_NameReferenceAmbiguous_Main" Description="@item_DescReferenceAmbiguous_Main" />
          </AttachDef>
        </SAttachableComponentParams>
        <SHealthComponentParams Health="42" />
        <PrimaryRef value="${staleRef}" />
      </EntityClassDefinition.ReferenceAmbiguous_Main>
    `,
  );
  await writeXml(
    xmlCacheDir,
    'libs/foundry/records/references/stale-ambiguous.xml',
    `<ReferenceRecord.Stale __ref="${staleRef}" __path="libs/foundry/records/references/stale-ambiguous.xml" linkedValue="stale" />`,
  );
  await writeXml(
    xmlCacheDir,
    'libs/foundry/records/references/graph-ambiguous.xml',
    `<ReferenceRecord.Graph __ref="${graphRef}" __path="libs/foundry/records/references/graph-ambiguous.xml" linkedValue="graph" />`,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'reference-ambiguous',
        csvFile: 'reference-ambiguous.datacore.csv',
        typeConfig: {
          recordFilter: 'libs/foundry/records/entities/scitem/reference_ambiguous',
          recordSelector: 'SAttachableComponentParams AttachDef[Type="ReferenceAmbiguous"]',
          entityClassPrefix: '',
          nameKeyInfix: '',
          fieldSelectors: {
            'Linked Value': {
              ref: {
                selector: 'PrimaryRef',
                attr: 'value',
              },
              selector: ':root',
              attr: 'linkedValue',
            },
          },
        },
      },
    ],
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 3,
      records: [
        {
          path: mainRecordPath,
          ref: 'main-ref',
          rootTag: 'EntityClassDefinition.ReferenceAmbiguous_Main',
          rootType: 'EntityClassDefinition',
          entityClass: 'reference_ambiguous_main',
          localizationKeys: [
            { attribute: 'Name', key: 'item_NameReferenceAmbiguous_Main' },
            { attribute: 'Description', key: 'item_DescReferenceAmbiguous_Main' },
          ],
          referencedGuids: [graphRef, otherGraphRef],
          referencedGuidAttributes: [
            { attribute: 'value', value: graphRef },
            { attribute: 'value', value: otherGraphRef },
          ],
        },
        {
          path: 'libs/foundry/records/references/stale-ambiguous.xml',
          ref: staleRef,
          rootTag: 'ReferenceRecord.Stale',
          rootType: 'ReferenceRecord',
          entityClass: 'Stale',
          localizationKeys: [],
          referencedGuids: [],
        },
        {
          path: 'libs/foundry/records/references/graph-ambiguous.xml',
          ref: graphRef,
          rootTag: 'ReferenceRecord.Graph',
          rootType: 'ReferenceRecord',
          entityClass: 'Graph',
          localizationKeys: [],
          referencedGuids: [],
        },
      ],
      indexes: {
        byRef: {
          'main-ref': mainRecordPath,
          [staleRef]: 'libs/foundry/records/references/stale-ambiguous.xml',
          [graphRef]: 'libs/foundry/records/references/graph-ambiguous.xml',
        },
        byPath: {
          [mainRecordPath]: 0,
          'libs/foundry/records/references/stale-ambiguous.xml': 1,
          'libs/foundry/records/references/graph-ambiguous.xml': 2,
        },
        byRootType: {
          EntityClassDefinition: [mainRecordPath],
          ReferenceRecord: [
            'libs/foundry/records/references/stale-ambiguous.xml',
            'libs/foundry/records/references/graph-ambiguous.xml',
          ],
        },
        byEntityClass: {
          reference_ambiguous_main: [mainRecordPath],
          Stale: ['libs/foundry/records/references/stale-ambiguous.xml'],
          Graph: ['libs/foundry/records/references/graph-ambiguous.xml'],
        },
        byLocalizationKey: {},
        byReferencedGuid: {
          [graphRef]: [mainRecordPath],
          [otherGraphRef]: [mainRecordPath],
        },
      },
    }),
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
  });

  const csv = await fs.readFile(
    path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'reference-ambiguous.datacore.csv'),
    'utf8',
  );

  assert.deepEqual(result.results, [
    { type: 'reference-ambiguous', rows: 1, skipped: 0, csvFile: 'reference-ambiguous.datacore.csv' },
  ]);
  assert.match(
    csv,
    /reference_ambiguous_main,item_NameReferenceAmbiguous_Main,,item_DescReferenceAmbiguous_Main,ACME,1,A,,42,\r?\n/,
  );
  assert.doesNotMatch(csv, /stale/);
});

test('runDatacoreScrape extracts power plant output from item resource generation', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-powerplant-output-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const xmlPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'ships',
    'powerplant',
    'powr_test_scitem.xml',
  );
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(
    xmlPath,
    `
      <EntityClassDefinition.POWR_Test_SCItem __path="libs/foundry/records/entities/scitem/ships/powerplant/powr_test_scitem.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="PowerPlant" Size="1" Grade="2" Manufacturer="ACOM">
              <Localization Name="@item_Name_POWR_Test" Description="@item_Desc_POWR_Test" />
            </AttachDef>
          </SAttachableComponentParams>
          <SHealthComponentParams Health="140" />
          <SDistortionParams DecayDelay="1.5" DecayRate="136.6667" Maximum="2050" />
          <SEntityPhysicsControllerParams>
            <PhysType>
              <SEntityRigidPhysicsControllerParams>
                <temperature>
                  <signatureParams minimumTemperatureForIR="311" temperatureToIR="9" />
                </temperature>
              </SEntityRigidPhysicsControllerParams>
            </PhysType>
          </SEntityPhysicsControllerParams>
          <ItemResourceComponentParams>
            <states>
              <ItemResourceState name="Online">
                <deltas>
                  <ItemResourceDeltaGeneration>
                    <generation resource="Power">
                      <resourceAmountPerSecond>
                        <SPowerSegmentResourceUnit units="16" />
                      </resourceAmountPerSecond>
                    </generation>
                    <consumption resource="Coolant">
                      <resourceAmountPerSecond>
                        <SStandardResourceUnit standardResourceUnits="0" />
                      </resourceAmountPerSecond>
                    </consumption>
                  </ItemResourceDeltaGeneration>
                </deltas>
                <signatureParams>
                  <EMSignature nominalSignature="750" decayRate="0.15" />
                  <IRSignature nominalSignature="4055" decayRate="0.5" />
                </signatureParams>
              </ItemResourceState>
            </states>
          </ItemResourceComponentParams>
        </Components>
      </EntityClassDefinition.POWR_Test_SCItem>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'powerplants',
        csvFile: 'powerplant.datacore.csv',
        typeConfig: POWERPLANT_TYPE_CONFIG,
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
  });

  const csv = await fs.readFile(
    path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'powerplant.datacore.csv'),
    'utf8',
  );

  assert.deepEqual(result.results, [{ type: 'powerplants', rows: 1, skipped: 0, csvFile: 'powerplant.datacore.csv' }]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Power Output,Cooling Usage,EM Signature,EM Signature Decay,IR Signature,IR Signature Decay,Temperature to IR,Minimum Temperature for IR,Distortion Shutdown Damage,Distortion Decay Delay,Distortion Decay Rate,Distortion Shutdown Time\r?\n/,
  );
  assert.match(
    csv,
    /powr_test,item_Name_POWR_Test,,item_Desc_POWR_Test,ACOM,1,2,,140,16,0,750,0\.15,4055,0\.5,9,311,2050,1\.5,136\.6667,16\.5/,
  );
});

test('runDatacoreScrape extracts cooler resource and signature params from real-shaped DataCore XML', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-coolers-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const xmlPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'ships',
    'cooler',
    'cool_acom_s01_iceplunge_scitem.xml',
  );
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(
    xmlPath,
    `
      <EntityClassDefinition.COOL_ACOM_S01_IcePlunge_SCItem __path="libs/foundry/records/entities/scitem/ships/cooler/cool_acom_s01_iceplunge_scitem.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="Cooler" SubType="UNDEFINED" Size="1" Grade="3" Manufacturer="ACOM">
              <Localization Name="@item_NameCOOL_ACOM_S01_IcePlunge" Description="@item_DescCOOL_ACOM_S01_IcePlunge" />
            </AttachDef>
          </SAttachableComponentParams>
          <SEntityPhysicsControllerParams>
            <PhysType>
              <SEntityRigidPhysicsControllerParams>
                <temperature>
                  <signatureParams minimumTemperatureForIR="250" temperatureToIR="0" />
                </temperature>
              </SEntityRigidPhysicsControllerParams>
            </PhysType>
          </SEntityPhysicsControllerParams>
          <SHealthComponentParams Health="69" />
          <ItemResourceComponentParams>
            <states>
              <ItemResourceState name="Online">
                <deltas>
                  <ItemResourceDeltaConversion>
                    <consumption resource="Power">
                      <resourceAmountPerSecond>
                        <SPowerSegmentResourceUnit units="2" />
                      </resourceAmountPerSecond>
                    </consumption>
                    <generation resource="Coolant">
                      <resourceAmountPerSecond>
                        <SStandardResourceUnit standardResourceUnits="34" />
                      </resourceAmountPerSecond>
                    </generation>
                  </ItemResourceDeltaConversion>
                </deltas>
                <signatureParams>
                  <EMSignature nominalSignature="818" decayRate="0.15" />
                  <IRSignature nominalSignature="5890" decayRate="0.5" />
                </signatureParams>
              </ItemResourceState>
            </states>
          </ItemResourceComponentParams>
          <SDistortionParams DecayDelay="1.5" DecayRate="70" Maximum="1050" />
        </Components>
      </EntityClassDefinition.COOL_ACOM_S01_IcePlunge_SCItem>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'coolers',
        csvFile: 'cooler.datacore.csv',
        typeConfig: COOLER_TYPE_CONFIG,
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
  });

  const csv = await fs.readFile(path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'cooler.datacore.csv'), 'utf8');

  assert.deepEqual(result.results, [{ type: 'coolers', rows: 1, skipped: 0, csvFile: 'cooler.datacore.csv' }]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Cooling Rate,Power Usage,EM Signature,EM Signature Decay,IR Signature,IR Signature Decay,Temperature to IR,Minimum Temperature for IR,Distortion Shutdown Damage,Distortion Decay Delay,Distortion Decay Rate,Distortion Shutdown Time\r?\n/,
  );
  assert.match(
    csv,
    /cool_acom_s01_iceplunge,item_NameCOOL_ACOM_S01_IcePlunge,,item_DescCOOL_ACOM_S01_IcePlunge,ACOM,1,3,,69,34,2,818,0\.15,5890,0\.5,0,250,1050,1\.5,70,16\.5/,
  );
});

test('runDatacoreScrape extracts missile launcher carriage from item ports', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-missile-launcher-carriage-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const xmlPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'ships',
    'missile_racks',
    'mrck_test.xml',
  );
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(
    xmlPath,
    `
      <EntityClassDefinition.MRCK_Test __path="libs/foundry/records/entities/scitem/ships/missile_racks/mrck_test.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="MissileLauncher" Size="6" Grade="1" Manufacturer="AEGS">
              <Localization Name="@item_NameMRCK_Test" Description="@item_DescMRCK_Test" />
            </AttachDef>
          </SAttachableComponentParams>
          <SHealthComponentParams Health="200" />
          <SItemPortContainerComponentParams>
            <Ports>
              <SItemPortDef Name="missile_01_attach" MinSize="3" MaxSize="3" />
              <SItemPortDef Name="missile_02_attach" MinSize="3" MaxSize="3" />
              <SItemPortDef Name="missile_03_attach" MinSize="3" MaxSize="3" />
            </Ports>
          </SItemPortContainerComponentParams>
        </Components>
      </EntityClassDefinition.MRCK_Test>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'missile-launchers',
        csvFile: 'missilelauncher.datacore.csv',
        typeConfig: MISSILE_LAUNCHER_TYPE_CONFIG,
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
  });

  const csv = await fs.readFile(
    path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'missilelauncher.datacore.csv'),
    'utf8',
  );

  assert.deepEqual(result.results, [
    { type: 'missile-launchers', rows: 1, skipped: 0, csvFile: 'missilelauncher.datacore.csv' },
  ]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Missile Quantity,Missile Size\r?\n/,
  );
  assert.match(csv, /mrck_test,item_NameMRCK_Test,,item_DescMRCK_Test,AEGS,6,1,,200,3,3/);
});

test('runDatacoreScrape follows countermeasure ammo param refs from defensive weapon records', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-weapon-defensive-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const countermeasurePath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'ships',
    'countermeasures',
    'aegs_test_cml_chaff.xml',
  );
  const ammoPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'ammoparams',
    'vehicle',
    'ammoparams.test_chaff.xml',
  );
  const manufacturerPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'scitemmanufacturer', 'aegs.xml');
  await fs.mkdir(path.dirname(countermeasurePath), { recursive: true });
  await fs.mkdir(path.dirname(ammoPath), { recursive: true });
  await fs.mkdir(path.dirname(manufacturerPath), { recursive: true });
  await fs.writeFile(
    countermeasurePath,
    `
      <EntityClassDefinition.AEGS_Test_CML_Chaff __path="libs/foundry/records/entities/scitem/ships/countermeasures/aegs_test_cml_chaff.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="WeaponDefensive" SubType="CountermeasureLauncher" Size="1" Grade="1" Manufacturer="cf4a74bf-eb2c-462a-9b78-f7f2724c31d2">
              <Localization Name="@item_NameAEGS_Test_CML_Chaff" ShortName="@hud_countermeasure_smokescreen" Description="@item_DescAEGS_Test_CML_Chaff" />
            </AttachDef>
          </SAttachableComponentParams>
          <SAmmoContainerComponentParams initialAmmoCount="12" maxAmmoCount="12" ammoParamsRecord="6c4fdf64-425c-4722-b286-dfedb06e8cfb" />
          <SHealthComponentParams Health="1000" />
        </Components>
      </EntityClassDefinition.AEGS_Test_CML_Chaff>
    `,
  );
  await fs.writeFile(
    ammoPath,
    `
      <AmmoParams.Test_Chaff __type="AmmoParams" __ref="6c4fdf64-425c-4722-b286-dfedb06e8cfb" __path="libs/foundry/records/ammoparams/vehicle/ammoparams.test_chaff.xml" lifetime="0.8" speed="180">
        <projectileParams>
          <CounterMeasureProjectileParams>
            <typeParams>
              <CounterMeasureChaffParams StartInfrared="80000" StartElectromagnetic="150000" StartCrossSection="100000" />
            </typeParams>
          </CounterMeasureProjectileParams>
        </projectileParams>
      </AmmoParams.Test_Chaff>
    `,
  );
  await fs.writeFile(
    manufacturerPath,
    `<SCItemManufacturer.AEGS Code="AEGS" __ref="cf4a74bf-eb2c-462a-9b78-f7f2724c31d2" />`,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'weapon-defensive',
        csvFile: 'weapondefensive.datacore.csv',
        typeConfig: WEAPON_DEFENSIVE_TYPE_CONFIG,
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 3,
  });

  const csv = await fs.readFile(
    path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'weapondefensive.datacore.csv'),
    'utf8',
  );

  assert.deepEqual(result.results, [
    { type: 'weapon-defensive', rows: 1, skipped: 0, csvFile: 'weapondefensive.datacore.csv' },
  ]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Type,Ammo Quantity,Ammo Speed,Ammo Lifetime,Signature IR,Signature CS,Signature EM\r?\n/,
  );
  assert.match(
    csv,
    /aegs_test_cml_chaff,item_NameAEGS_Test_CML_Chaff,hud_countermeasure_smokescreen,item_DescAEGS_Test_CML_Chaff,AEGS,1,1,CountermeasureLauncher,1000,Chaff,12,180,0\.8,80000,100000,150000/,
  );
});

test('runDatacoreScrape extracts weapon attachment modifiers from real-shaped DataCore XML', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-weapon-attachments-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const attachmentPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'weapons',
    'weapon_modifier',
    'behr_optics_test.xml',
  );
  const manufacturerPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'scitemmanufacturer', 'behr.xml');
  await fs.mkdir(path.dirname(attachmentPath), { recursive: true });
  await fs.mkdir(path.dirname(manufacturerPath), { recursive: true });
  await fs.writeFile(
    attachmentPath,
    `
      <EntityClassDefinition.behr_optics_test __path="libs/foundry/records/entities/scitem/weapons/weapon_modifier/behr_optics_test.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="WeaponAttachment" SubType="IronSight" Size="2" Grade="1" Manufacturer="65a5d887-3b21-4046-a718-6912c0c7c3be">
              <Localization Name="@item_Namebehr_optics_test" Description="@item_Descbehr_optics_test" />
            </AttachDef>
          </SAttachableComponentParams>
          <SWeaponModifierComponentParams>
            <modifier>
              <weaponStats damageMultiplier="1.05" projectileSpeedMultiplier="1.35" heatGenerationMultiplier="0.75" soundRadiusMultiplier="0.66">
                <aimModifier zoomScale="4" secondZoomScale="6" zoomTimeScale="1.25" />
              </weaponStats>
            </modifier>
          </SWeaponModifierComponentParams>
        </Components>
      </EntityClassDefinition.behr_optics_test>
    `,
  );
  await fs.writeFile(
    manufacturerPath,
    `<SCItemManufacturer.BEHR Code="BEHR" __ref="65a5d887-3b21-4046-a718-6912c0c7c3be" />`,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'weapon-attachments',
        csvFile: 'weaponattachment.datacore.csv',
        typeConfig: WEAPON_ATTACHMENT_TYPE_CONFIG,
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 2,
  });

  const csv = await fs.readFile(
    path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'weaponattachment.datacore.csv'),
    'utf8',
  );

  assert.deepEqual(result.results, [
    { type: 'weapon-attachments', rows: 1, skipped: 0, csvFile: 'weaponattachment.datacore.csv' },
  ]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Slot,Damage Modifier,Projectile Speed Modifier,Heat Modifier,Magnification,Aim Time Modifier,Sound Radius Modifier\r?\n/,
  );
  assert.match(
    csv,
    /behr_optics_test,item_Namebehr_optics_test,,item_Descbehr_optics_test,BEHR,2,1,IronSight,,IronSight,1\.05,1\.35,0\.75,4 \/ 6,1\.25,0\.66/,
  );
});

test('runDatacoreScrape extracts vehicle gun combat stats through linked ammo params', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-weapon-guns-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const gunPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'ships',
    'weapons',
    'mgun_test_laser_s1.xml',
  );
  const ammoPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'ammoparams',
    'vehicle',
    'ammoparams.mgun_test_laser_s1.xml',
  );
  const manufacturerPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'scitemmanufacturer', 'amrs.xml');
  await fs.mkdir(path.dirname(gunPath), { recursive: true });
  await fs.mkdir(path.dirname(ammoPath), { recursive: true });
  await fs.mkdir(path.dirname(manufacturerPath), { recursive: true });
  await fs.writeFile(
    gunPath,
    `
      <EntityClassDefinition.MGUN_Test_Laser_S1 __path="libs/foundry/records/entities/scitem/ships/weapons/mgun_test_laser_s1.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="WeaponGun" SubType="Gun" Size="1" Grade="1" Manufacturer="eccba58a-f6d9-42e8-95c6-d0a65763e583">
              <Localization Name="@item_NameMGUN_Test_Laser_S1" ShortName="@item_NameMGUN_Test_Laser_S1_short" Description="@item_DescMGUN_Test_Laser_S1" />
            </AttachDef>
          </SAttachableComponentParams>
          <SAmmoContainerComponentParams maxAmmoCount="0" ammoParamsRecord="20661f50-2ba8-46bb-81c7-039c60e84e7c" />
          <SHealthComponentParams Health="550" />
          <SCItemWeaponComponentParams>
            <fireActions>
              <SWeaponActionSequenceParams>
                <sequenceEntries>
                  <SWeaponSequenceEntryParams>
                    <weaponAction>
                      <SWeaponActionFireSingleParams fireRate="150" heatPerShot="2">
                        <launchParams>
                          <SProjectileLauncher ammoCost="1" pelletCount="1" />
                        </launchParams>
                      </SWeaponActionFireSingleParams>
                    </weaponAction>
                  </SWeaponSequenceEntryParams>
                </sequenceEntries>
              </SWeaponActionSequenceParams>
            </fireActions>
          </SCItemWeaponComponentParams>
        </Components>
      </EntityClassDefinition.MGUN_Test_Laser_S1>
    `,
  );
  await fs.writeFile(
    ammoPath,
    `
      <AmmoParams.MGUN_Test_Laser_S1 __type="AmmoParams" __ref="20661f50-2ba8-46bb-81c7-039c60e84e7c" __path="libs/foundry/records/ammoparams/vehicle/ammoparams.mgun_test_laser_s1.xml" lifetime="1.43" speed="1400">
        <projectileParams>
          <BulletProjectileParams>
            <damage>
              <DamageInfo DamagePhysical="0" DamageEnergy="97.2" DamageDistortion="3" DamageThermal="0" DamageBiochemical="0" DamageStun="0" />
            </damage>
          </BulletProjectileParams>
        </projectileParams>
      </AmmoParams.MGUN_Test_Laser_S1>
    `,
  );
  await fs.writeFile(
    manufacturerPath,
    `<SCItemManufacturer.AMRS Code="AMRS" __ref="eccba58a-f6d9-42e8-95c6-d0a65763e583" />`,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'weapon-guns',
        csvFile: 'weapongun.datacore.csv',
        typeConfig: WEAPON_GUN_TYPE_CONFIG,
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 3,
  });

  const csv = await fs.readFile(path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'weapongun.datacore.csv'), 'utf8');

  assert.deepEqual(result.results, [{ type: 'weapon-guns', rows: 1, skipped: 0, csvFile: 'weapongun.datacore.csv' }]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Damage Alpha,Rate of Fire,Projectile Speed,Ammo Range,Ammo Quantity,Heat Per Shot\r?\n/,
  );
  assert.match(
    csv,
    /mgun_test_laser_s1,item_NameMGUN_Test_Laser_S1,item_NameMGUN_Test_Laser_S1_short,item_DescMGUN_Test_Laser_S1,AMRS,1,1,Gun,550,100\.2,150,1400,2002,0,2/,
  );
});

test('runDatacoreScrape extracts personal weapon stats through default magazine ammo params', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-weapon-personal-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const weaponPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'weapons',
    'fps_weapons',
    'behr_lmg_ballistic_01.xml',
  );
  const magazinePath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'weapons',
    'magazines',
    'behr_lmg_ballistic_01_mag.xml',
  );
  const ammoPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'ammoparams',
    'fps',
    'behr_lmg_ballistic_01_ammo.xml',
  );
  const manufacturerPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'scitemmanufacturer', 'behr.xml');
  await fs.mkdir(path.dirname(weaponPath), { recursive: true });
  await fs.mkdir(path.dirname(magazinePath), { recursive: true });
  await fs.mkdir(path.dirname(ammoPath), { recursive: true });
  await fs.mkdir(path.dirname(manufacturerPath), { recursive: true });
  await fs.writeFile(
    weaponPath,
    `
      <EntityClassDefinition.behr_lmg_ballistic_01 __path="libs/foundry/records/entities/scitem/weapons/fps_weapons/behr_lmg_ballistic_01.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="WeaponPersonal" SubType="Medium" Size="4" Grade="1" Manufacturer="65a5d887-3b21-4046-a718-6912c0c7c3be">
              <Localization Name="@item_Namebehr_lmg_ballistic_01" ShortName="@item_Namebehr_lmg_ballistic_01_short" Description="@item_Descbehr_lmg_ballistic_01" />
            </AttachDef>
          </SAttachableComponentParams>
          <SCItemWeaponComponentParams>
            <fireActions>
              <SWeaponActionFireRapidParams aiShootingMode="Rapid" fireRate="650" heatPerShot="1">
                <launchParams>
                  <SProjectileLauncher ammoCost="1" pelletCount="1" />
                </launchParams>
              </SWeaponActionFireRapidParams>
            </fireActions>
          </SCItemWeaponComponentParams>
          <GraphRelationships entityClassReference="b5f37920-ba9a-4a07-85e9-732c31d04d8a" />
          <SEntityComponentDefaultLoadoutParams>
            <loadout>
              <SItemPortLoadoutManualParams>
                <entries>
                  <SItemPortLoadoutEntryParams itemPortName="magazine_attach" entityClassName="stale_magazine_class" entityClassReference="stale-magazine-ref" />
                </entries>
              </SItemPortLoadoutManualParams>
            </loadout>
          </SEntityComponentDefaultLoadoutParams>
        </Components>
      </EntityClassDefinition.behr_lmg_ballistic_01>
    `,
  );
  await fs.writeFile(
    magazinePath,
    `
      <EntityClassDefinition.behr_lmg_ballistic_01_mag __ref="b5f37920-ba9a-4a07-85e9-732c31d04d8a" __path="libs/foundry/records/entities/scitem/weapons/magazines/behr_lmg_ballistic_01_mag.xml">
        <Components>
          <GraphRelationships ammoParamsRecord="164cba0d-026f-42a6-a6a0-55a8bfe8b480" />
          <SAmmoContainerComponentParams maxAmmoCount="75" ammoParamsRecord="stale-ammo-param-ref" />
        </Components>
      </EntityClassDefinition.behr_lmg_ballistic_01_mag>
    `,
  );
  await fs.writeFile(
    ammoPath,
    `
      <AmmoParams.behr_lmg_ballistic_01_ammo __type="AmmoParams" __ref="164cba0d-026f-42a6-a6a0-55a8bfe8b480" __path="libs/foundry/records/ammoparams/fps/behr_lmg_ballistic_01_ammo.xml" lifetime="1.9" speed="500">
        <projectileParams>
          <BulletProjectileParams>
            <damage>
              <DamageInfo DamagePhysical="22.5" DamageEnergy="0" DamageDistortion="0" DamageThermal="0" DamageBiochemical="0" DamageStun="0" />
            </damage>
          </BulletProjectileParams>
        </projectileParams>
      </AmmoParams.behr_lmg_ballistic_01_ammo>
    `,
  );
  await fs.writeFile(
    manufacturerPath,
    `<SCItemManufacturer.BEHR Code="BEHR" __ref="65a5d887-3b21-4046-a718-6912c0c7c3be" />`,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'weapon-personal',
        csvFile: 'weaponpersonal.datacore.csv',
        typeConfig: WEAPON_PERSONAL_TYPE_CONFIG,
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 4,
  });

  const csv = await fs.readFile(
    path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'weaponpersonal.datacore.csv'),
    'utf8',
  );

  assert.deepEqual(result.results, [
    { type: 'weapon-personal', rows: 1, skipped: 0, csvFile: 'weaponpersonal.datacore.csv' },
  ]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Damage Alpha,Rate of Fire,Fire Mode,Projectile Speed,Ammo Range,Ammo Quantity\r?\n/,
  );
  assert.match(
    csv,
    /behr_lmg_ballistic_01,item_Namebehr_lmg_ballistic_01,item_Namebehr_lmg_ballistic_01_short,item_Descbehr_lmg_ballistic_01,BEHR,4,1,Medium,,22\.5,650,Rapid,500,950,75/,
  );
});

test('runDatacoreScrape resolves default magazines by normalized graph entity class references', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-weapon-personal-entity-ref-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const weaponPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'weapons',
    'fps_weapons',
    'behr_lmg_ballistic_02.xml',
  );
  const magazinePath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'weapons',
    'magazines',
    'behr_lmg_ballistic_02_mag.xml',
  );
  const ammoPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'ammoparams',
    'fps',
    'behr_lmg_ballistic_02_ammo.xml',
  );
  await fs.mkdir(path.dirname(weaponPath), { recursive: true });
  await fs.mkdir(path.dirname(magazinePath), { recursive: true });
  await fs.mkdir(path.dirname(ammoPath), { recursive: true });
  await fs.writeFile(
    weaponPath,
    `
      <EntityClassDefinition.behr_lmg_ballistic_02 __path="libs/foundry/records/entities/scitem/weapons/fps_weapons/behr_lmg_ballistic_02.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="WeaponPersonal" SubType="Medium" Size="4" Grade="1" Manufacturer="BEHR">
              <Localization Name="@item_Namebehr_lmg_ballistic_02" ShortName="@item_Namebehr_lmg_ballistic_02_short" Description="@item_Descbehr_lmg_ballistic_02" />
            </AttachDef>
          </SAttachableComponentParams>
          <SCItemWeaponComponentParams>
            <fireActions>
              <SWeaponActionFireRapidParams aiShootingMode="Rapid" fireRate="700" />
            </fireActions>
          </SCItemWeaponComponentParams>
          <SEntityComponentDefaultLoadoutParams>
            <loadout>
              <SItemPortLoadoutManualParams>
                <entries>
                  <SItemPortLoadoutEntryParams itemPortName="magazine_attach" entityClassName="BEHR_LMG_BALLISTIC_02_MAG_SCItem" />
                </entries>
              </SItemPortLoadoutManualParams>
            </loadout>
          </SEntityComponentDefaultLoadoutParams>
        </Components>
      </EntityClassDefinition.behr_lmg_ballistic_02>
    `,
  );
  await fs.writeFile(
    magazinePath,
    `
      <EntityClassDefinition.behr_lmg_ballistic_02_mag __path="libs/foundry/records/entities/scitem/weapons/magazines/behr_lmg_ballistic_02_mag.xml">
        <Components>
          <SAmmoContainerComponentParams maxAmmoCount="60" ammoParamsRecord="264cba0d-026f-42a6-a6a0-55a8bfe8b480" />
        </Components>
      </EntityClassDefinition.behr_lmg_ballistic_02_mag>
    `,
  );
  await fs.writeFile(
    ammoPath,
    `
      <AmmoParams.behr_lmg_ballistic_02_ammo __type="AmmoParams" __ref="264cba0d-026f-42a6-a6a0-55a8bfe8b480" __path="libs/foundry/records/ammoparams/fps/behr_lmg_ballistic_02_ammo.xml" lifetime="2" speed="500">
        <projectileParams>
          <BulletProjectileParams>
            <damage>
              <DamageInfo DamagePhysical="30" DamageEnergy="0" DamageDistortion="0" DamageThermal="0" DamageBiochemical="0" DamageStun="0" />
            </damage>
          </BulletProjectileParams>
        </projectileParams>
      </AmmoParams.behr_lmg_ballistic_02_ammo>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'weapon-personal',
        csvFile: 'weaponpersonal.datacore.csv',
        typeConfig: WEAPON_PERSONAL_TYPE_CONFIG,
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 3,
  });

  const csv = await fs.readFile(
    path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'weaponpersonal.datacore.csv'),
    'utf8',
  );

  assert.deepEqual(result.results, [
    { type: 'weapon-personal', rows: 1, skipped: 0, csvFile: 'weaponpersonal.datacore.csv' },
  ]);
  assert.match(
    csv,
    /behr_lmg_ballistic_02,item_Namebehr_lmg_ballistic_02,item_Namebehr_lmg_ballistic_02_short,item_Descbehr_lmg_ballistic_02,BEHR,4,1,Medium,,30,700,Rapid,500,1000,60/,
  );
});

test('runDatacoreScrape extracts bomb params and skips missile records in shared ordnance folder', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-bombs-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const ordnanceDir = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'ships',
    'weapons',
    'missiles',
  );
  const manufacturerPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'scitemmanufacturer', 'fski.xml');
  await fs.mkdir(ordnanceDir, { recursive: true });
  await fs.mkdir(path.dirname(manufacturerPath), { recursive: true });
  await fs.writeFile(
    path.join(ordnanceDir, 'bomb_s03_fski_thunderball.xml'),
    `
      <EntityClassDefinition.BOMB_S03_FSKI_Thunderball __path="libs/foundry/records/entities/scitem/ships/weapons/missiles/bomb_s03_fski_thunderball.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="Bomb" SubType="Utility" Size="3" Grade="1" Manufacturer="5f81335d-44e6-4104-841e-c5af9df06829">
              <Localization Name="@item_NameBOMB_S03_FSKI_Thunderball" ShortName="@item_NameBOMB_S03_FSKI_Thunderball_short" Description="@item_DescBOMB_S03_FSKI_Thunderball" />
            </AttachDef>
          </SAttachableComponentParams>
          <SCItemBombParams armTime="0.5" igniteTime="0.1" projectileProximity="0.5">
            <explosionParams minRadius="40" maxRadius="40">
              <damage>
                <DamageInfo DamagePhysical="12500" DamageEnergy="14500" DamageDistortion="0" />
              </damage>
            </explosionParams>
          </SCItemBombParams>
          <SHealthComponentParams Health="1000" />
        </Components>
      </EntityClassDefinition.BOMB_S03_FSKI_Thunderball>
    `,
  );
  await fs.writeFile(
    path.join(ordnanceDir, 'gmisl_s01_cs_fski_spark.xml'),
    `
      <EntityClassDefinition.GMISL_S01_CS_FSKI_Spark __path="libs/foundry/records/entities/scitem/ships/weapons/missiles/gmisl_s01_cs_fski_spark.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="Missile" SubType="GroundVehicleMissile" Size="1" Grade="1" Manufacturer="5f81335d-44e6-4104-841e-c5af9df06829" />
          </SAttachableComponentParams>
          <SCItemMissileParams />
        </Components>
      </EntityClassDefinition.GMISL_S01_CS_FSKI_Spark>
    `,
  );
  await fs.writeFile(
    manufacturerPath,
    `<SCItemManufacturer.FSKI Code="FSKI" __ref="5f81335d-44e6-4104-841e-c5af9df06829" />`,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [{ name: 'bombs', csvFile: 'bomb.datacore.csv', typeConfig: BOMB_TYPE_CONFIG }],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 3,
  });

  const csv = await fs.readFile(path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'bomb.datacore.csv'), 'utf8');

  assert.deepEqual(result.results, [{ type: 'bombs', rows: 1, skipped: 1, csvFile: 'bomb.datacore.csv' }]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Damage Total,Damage Physical,Damage Energy,Damage Distortion,Arm Delay,Ignite Delay,Explosion Radius,Explosion Proximity\r?\n/,
  );
  assert.match(
    csv,
    /bomb_s03_fski_thunderball,item_NameBOMB_S03_FSKI_Thunderball,item_NameBOMB_S03_FSKI_Thunderball_short,item_DescBOMB_S03_FSKI_Thunderball,FSKI,3,1,Utility,1000,27000,12500,14500,0,0\.5,0\.1,40,0\.5/,
  );
});

test('runDatacoreScrape extracts missile params and skips bomb records in shared ordnance folder', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-missiles-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const ordnanceDir = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'ships',
    'weapons',
    'missiles',
  );
  const manufacturerPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'scitemmanufacturer', 'fski.xml');
  await fs.mkdir(ordnanceDir, { recursive: true });
  await fs.mkdir(path.dirname(manufacturerPath), { recursive: true });
  await fs.writeFile(
    path.join(ordnanceDir, 'gmisl_s01_cs_fski_spark.xml'),
    `
      <EntityClassDefinition.GMISL_S01_CS_FSKI_Spark __path="libs/foundry/records/entities/scitem/ships/weapons/missiles/gmisl_s01_cs_fski_spark.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="Missile" SubType="GroundVehicleMissile" Size="1" Grade="1" Manufacturer="5f81335d-44e6-4104-841e-c5af9df06829">
              <Localization Name="@item_NameGMISL_S01_CS_FSKI_Spark" ShortName="@item_NameGMISL_S01_CS_FSKI_Spark_short" Description="@item_DescGMISL_S01_CS_FSKI_Spark" />
            </AttachDef>
          </SAttachableComponentParams>
          <SCItemMissileParams armTime="0.8">
            <explosionParams minRadius="1" maxRadius="2">
              <damage>
                <DamageInfo DamagePhysical="1150" DamageEnergy="0" DamageDistortion="0" />
              </damage>
            </explosionParams>
            <GCSParams linearSpeed="1372" />
            <targetingParams trackingSignalType="CrossSection" lockTime="0.4" lockRangeMin="50" lockRangeMax="10000" lockingAngle="60" />
          </SCItemMissileParams>
          <SHealthComponentParams Health="25" />
        </Components>
      </EntityClassDefinition.GMISL_S01_CS_FSKI_Spark>
    `,
  );
  await fs.writeFile(
    path.join(ordnanceDir, 'bomb_s03_fski_thunderball.xml'),
    `
      <EntityClassDefinition.BOMB_S03_FSKI_Thunderball __path="libs/foundry/records/entities/scitem/ships/weapons/missiles/bomb_s03_fski_thunderball.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="Bomb" SubType="Utility" Size="3" Grade="1" Manufacturer="5f81335d-44e6-4104-841e-c5af9df06829" />
          </SAttachableComponentParams>
          <SCItemBombParams />
        </Components>
      </EntityClassDefinition.BOMB_S03_FSKI_Thunderball>
    `,
  );
  await fs.writeFile(
    manufacturerPath,
    `<SCItemManufacturer.FSKI Code="FSKI" __ref="5f81335d-44e6-4104-841e-c5af9df06829" />`,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [{ name: 'missiles', csvFile: 'missile.datacore.csv', typeConfig: MISSILE_TYPE_CONFIG }],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 3,
  });

  const csv = await fs.readFile(path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'missile.datacore.csv'), 'utf8');

  assert.deepEqual(result.results, [{ type: 'missiles', rows: 1, skipped: 1, csvFile: 'missile.datacore.csv' }]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Tracking Signal,Damage Total,Damage Physical,Damage Energy,Damage Distortion,Speed,Arm Delay,Lock Delay,Lock Range,Lock Angle,Explosion Radius\r?\n/,
  );
  assert.match(
    csv,
    /gmisl_s01_cs_fski_spark,item_NameGMISL_S01_CS_FSKI_Spark,item_NameGMISL_S01_CS_FSKI_Spark_short,item_DescGMISL_S01_CS_FSKI_Spark,FSKI,1,1,GroundVehicleMissile,25,CrossSection,1150,1150,0,0,1372,0\.8,0\.4,50 - 10000,60,1 - 2/,
  );
});

test('runDatacoreScrape extracts quantum drive params from DataCore item records', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-quantum-drives-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const xmlPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'ships',
    'quantumdrive',
    'qdrv_wetk_s02_xl1_scitem.xml',
  );
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(
    xmlPath,
    `
      <EntityClassDefinition.QDRV_WETK_S02_XL1_SCItem __path="libs/foundry/records/entities/scitem/ships/quantumdrive/qdrv_wetk_s02_xl1_scitem.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="QuantumDrive" Size="2" Grade="1" Manufacturer="WETK">
              <Localization Name="@item_NameQDRV_WETK_S02_XL1_SCItem" Description="@item_DescQDRV_WETK_S02_XL1_SCItem" />
            </AttachDef>
          </SAttachableComponentParams>
          <SHealthComponentParams Health="290" />
          <SCItemQuantumDriveParams quantumFuelRequirement="0.02398" jumpRange="3.402823E+38" disconnectRange="38076">
            <params driveSpeed="324000000" cooldownTime="22.86" stageOneAccelRate="4830000" stageTwoAccelRate="21300000" interdictionEffectTime="5" spoolUpTime="6" />
            <splineJumpParams driveSpeed="400000" cooldownTime="22.86" stageOneAccelRate="250" stageTwoAccelRate="50000" spoolUpTime="6" />
          </SCItemQuantumDriveParams>
        </Components>
      </EntityClassDefinition.QDRV_WETK_S02_XL1_SCItem>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'quantum-drives',
        csvFile: 'quantumdrive.datacore.csv',
        typeConfig: QUANTUM_DRIVE_TYPE_CONFIG,
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
  });

  const csv = await fs.readFile(
    path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'quantumdrive.datacore.csv'),
    'utf8',
  );

  assert.deepEqual(result.results, [
    { type: 'quantum-drives', rows: 1, skipped: 0, csvFile: 'quantumdrive.datacore.csv' },
  ]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Max Speed,Stage 1 Accel,Stage 2 Accel,Spline Speed,Spool Time,Cooldown,Interdiction Delay,Fuel Rate\r?\n/,
  );
  assert.match(
    csv,
    /qdrv_wetk_s02_xl1,item_NameQDRV_WETK_S02_XL1_SCItem,,item_DescQDRV_WETK_S02_XL1_SCItem,WETK,2,1,,290,324000000,4830000,21300000,400000,6,22\.86,5,0\.02398/,
  );
});

test('runDatacoreScrape extracts QED params from DataCore item records', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-qeds-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const xmlPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'ships',
    'quantumenforcementdevice',
    'qed_wetk_s03_reynie.xml',
  );
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(
    xmlPath,
    `
      <EntityClassDefinition.QED_WETK_S03_Reynie __path="libs/foundry/records/entities/scitem/ships/quantumenforcementdevice/qed_wetk_s03_reynie.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="QuantumInterdictionGenerator" Size="1" Grade="1" Manufacturer="WETK">
              <Localization Name="@item_NameQED_WETK_S03_Reynie" ShortName="@item_NameQED_WETK_S03_Reynie" Description="@item_DescQED_WETK_S03_Reynie" />
            </AttachDef>
          </SAttachableComponentParams>
          <SHealthComponentParams Health="1100" />
          <SCItemQuantumInterdictionGeneratorParams basePowerDrawFraction="0.18" pulsePowerFraction="0.82" jammerPowerFraction="0.18">
            <jammerSettings>
              <SCItemQuantumJammerParams jammerRange="12000" maxPowerDraw="200" greenZoneCheckRange="4000" />
            </jammerSettings>
            <quantumInterdictionPulseSettings>
              <SCItemQuantumInterdictionPulseParams chargeTimeSecs="90" dischargeTimeSecs="30" cooldownTimeSecs="1" radiusMeters="20000" activationPhaseDuration_seconds="3" />
            </quantumInterdictionPulseSettings>
          </SCItemQuantumInterdictionGeneratorParams>
        </Components>
      </EntityClassDefinition.QED_WETK_S03_Reynie>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'qeds',
        csvFile: 'qed.datacore.csv',
        typeConfig: QED_TYPE_CONFIG,
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
  });

  const csv = await fs.readFile(path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'qed.datacore.csv'), 'utf8');

  assert.deepEqual(result.results, [{ type: 'qeds', rows: 1, skipped: 0, csvFile: 'qed.datacore.csv' }]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Jammer Range,Interdiction Range,Charge Delay,Activation Delay,Cooldown\r?\n/,
  );
  assert.match(
    csv,
    /qed_wetk_s03_reynie,item_NameQED_WETK_S03_Reynie,item_NameQED_WETK_S03_Reynie,item_DescQED_WETK_S03_Reynie,WETK,1,1,,1100,12000,20000,90,3,1/,
  );
});

test('runDatacoreScrape extracts jump drive params from real-shaped DataCore XML', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-jump-drives-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const jumpDrivePath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'ships',
    'jumpdrive',
    'jdrv_aegs_s04_javelin_scitem.xml',
  );
  const manufacturerPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'scitemmanufacturer',
    'scitemmanufacturer.aegs.xml',
  );
  await fs.mkdir(path.dirname(jumpDrivePath), { recursive: true });
  await fs.mkdir(path.dirname(manufacturerPath), { recursive: true });
  await fs.writeFile(
    jumpDrivePath,
    `
      <EntityClassDefinition.JDRV_AEGS_S04_Javelin_SCItem __path="libs/foundry/records/entities/scitem/ships/jumpdrive/jdrv_aegs_s04_javelin_scitem.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="JumpDrive" SubType="UNDEFINED" Size="4" Grade="3" Manufacturer="cf4a74bf-eb2c-462a-9b78-f7f2724c31d2">
              <Localization Name="@LOC_PLACEHOLDER" ShortName="@LOC_EMPTY" Description="@LOC_EMPTY" />
            </AttachDef>
          </SAttachableComponentParams>
          <SHealthComponentParams Health="77000" />
          <SDistortionParams DecayDelay="1" DecayRate="345.6" Maximum="1728" />
          <SCItemJumpDriveParams alignmentRate="0.2" alignmentDecayRate="0.1" tuningRate="0.26" tuningDecayRate="0.5" fuelUsageEfficiencyMultiplier="8" />
        </Components>
      </EntityClassDefinition.JDRV_AEGS_S04_Javelin_SCItem>
    `,
  );
  await fs.writeFile(
    manufacturerPath,
    `
      <SCItemManufacturer.AEGS Code="AEG" __type="SCItemManufacturer" __ref="cf4a74bf-eb2c-462a-9b78-f7f2724c31d2" __path="libs/foundry/records/scitemmanufacturer/scitemmanufacturer.aegs.xml">
        <Localization Name="@manufacturer_NameAEGS" Description="@manufacturer_DescAEGS" />
      </SCItemManufacturer.AEGS>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'jump-drives',
        csvFile: 'jumpdrive.datacore.csv',
        typeConfig: JUMP_DRIVE_TYPE_CONFIG,
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 2,
  });

  const csv = await fs.readFile(path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'jumpdrive.datacore.csv'), 'utf8');

  assert.deepEqual(result.results, [{ type: 'jump-drives', rows: 1, skipped: 0, csvFile: 'jumpdrive.datacore.csv' }]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Alignment Rate,Alignment Decay,Tuning Rate,Tuning Decay,Fuel Usage Mult,Distortion Shutdown Damage,Distortion Decay Delay,Distortion Decay Rate,Distortion Shutdown Time\r?\n/,
  );
  assert.match(csv, /jdrv_aegs_s04_javelin,,,,AEGS,4,3,,77000,0\.2,0\.1,0\.26,0\.5,8,1728,1,345\.6,6/);
});

test('runDatacoreScrape extracts EMP params from real-shaped DataCore XML', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-emps-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const empPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'ships',
    'weapons',
    'emp',
    'tmbl_emp_device_s1.xml',
  );
  const manufacturerPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'scitemmanufacturer', 'tmbl.xml');
  await fs.mkdir(path.dirname(empPath), { recursive: true });
  await fs.mkdir(path.dirname(manufacturerPath), { recursive: true });
  await fs.writeFile(
    empPath,
    `
      <EntityClassDefinition.TMBL_EMP_Device_S1 __path="libs/foundry/records/entities/scitem/ships/weapons/emp/tmbl_emp_device_s1.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="EMP" SubType="UNDEFINED" Size="1" Grade="1" Manufacturer="bb1024bc-b82e-491c-820c-36662c36feb3">
              <Localization Name="@item_NameMXOX_EMP_Device" ShortName="@item_NameMXOX_EMP_Device" Description="@item_DescMXOX_EMP_Device" />
            </AttachDef>
          </SAttachableComponentParams>
          <SCItemEMPParams chargeTime="12" distortionDamage="1000" empRadius="400" minEmpRadius="150" physRadius="250" minPhysRadius="150" pressure="0" unleashTime="0.75" cooldownTime="6" />
          <SHealthComponentParams Health="150" />
        </Components>
      </EntityClassDefinition.TMBL_EMP_Device_S1>
    `,
  );
  await fs.writeFile(
    manufacturerPath,
    `
      <SCItemManufacturer.TMBL Code="TMBL" __type="SCItemManufacturer" __ref="bb1024bc-b82e-491c-820c-36662c36feb3" __path="libs/foundry/records/scitemmanufacturer/tmbl.xml">
        <Localization Name="@manufacturer_NameTMBL" Description="@manufacturer_DescTMBL" />
      </SCItemManufacturer.TMBL>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'emps',
        csvFile: 'emp.datacore.csv',
        typeConfig: EMP_TYPE_CONFIG,
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 2,
  });

  const csv = await fs.readFile(path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'emp.datacore.csv'), 'utf8');

  assert.deepEqual(result.results, [{ type: 'emps', rows: 1, skipped: 0, csvFile: 'emp.datacore.csv' }]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Damage Total,Damage Radius,Damage Radius Min,Physical Radius,Physical Radius Min,Pressure,Charge Delay,Unleash Delay,Cooldown\r?\n/,
  );
  assert.match(
    csv,
    /tmbl_emp_device_s1,item_NameMXOX_EMP_Device,item_NameMXOX_EMP_Device,item_DescMXOX_EMP_Device,TMBL,1,1,,150,1000,400,150,250,150,0,12,0\.75,6/,
  );
});

test('runDatacoreScrape extracts self-destruct params from real-shaped DataCore XML', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-self-destruct-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const selfDestructPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'ships',
    'selfdestruct',
    'vhcl_selfdestruct_120s.xml',
  );
  await fs.mkdir(path.dirname(selfDestructPath), { recursive: true });
  await fs.writeFile(
    selfDestructPath,
    `
      <EntityClassDefinition.VHCL_SelfDestruct_120s __path="libs/foundry/records/entities/scitem/ships/selfdestruct/vhcl_selfdestruct_120s.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="SelfDestruct" SubType="UNDEFINED" Size="1" Grade="1" inheritParentManufacturer="1">
              <Localization Name="@item_TypeSelfDestruct" ShortName="@LOC_EMPTY" Description="@item_TypeSelfDestruct" />
            </AttachDef>
          </SAttachableComponentParams>
          <SSCItemSelfDestructComponentParams damage="120000" minRadius="100" radius="175" minPhysRadius="110" physRadius="150" time="120" />
        </Components>
      </EntityClassDefinition.VHCL_SelfDestruct_120s>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'self-destruct',
        csvFile: 'selfdestruct.datacore.csv',
        typeConfig: SELF_DESTRUCT_TYPE_CONFIG,
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
  });

  const csv = await fs.readFile(
    path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'selfdestruct.datacore.csv'),
    'utf8',
  );

  assert.deepEqual(result.results, [
    { type: 'self-destruct', rows: 1, skipped: 0, csvFile: 'selfdestruct.datacore.csv' },
  ]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Countdown,Explosion Damage,Explosion Radius\r?\n/,
  );
  assert.match(csv, /vhcl_selfdestruct_120s,item_TypeSelfDestruct,,item_TypeSelfDestruct,,1,1,,,120,120000,100 - 175/);
});

test('runDatacoreScrape extracts throwable explosion params from triggerable devices', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-throwables-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const throwablePath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'weapons',
    'throwable',
    'behr_gren_frag_01.xml',
  );
  const manufacturerPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'scitemmanufacturer', 'behr.xml');
  await fs.mkdir(path.dirname(throwablePath), { recursive: true });
  await fs.mkdir(path.dirname(manufacturerPath), { recursive: true });
  await fs.writeFile(
    throwablePath,
    `
      <EntityClassDefinition.behr_gren_frag_01 __path="libs/foundry/records/entities/scitem/weapons/throwable/behr_gren_frag_01.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="WeaponPersonal" SubType="Grenade" Size="1" Grade="1" Manufacturer="65a5d887-3b21-4046-a718-6912c0c7c3be">
              <Localization Name="@item_Namebehr_frag_grenade_01" ShortName="@item_Namebehr_frag_grenade_01_short" Description="@item_Descbehr_frag_grenade_01" />
            </AttachDef>
          </SAttachableComponentParams>
          <EntityComponentTriggerableDevicesParams>
            <triggers>
              <STriggerableDevicesTriggerTimerParams name="Pre explosion" duration="5">
                <behavior>
                  <STriggerableDevicesBehaviorExplosionParams name="Explosion">
                    <explosionParams minRadius="4" maxRadius="5.5" pressure="280">
                      <damage>
                        <DamageInfo DamagePhysical="20" DamageEnergy="0" DamageDistortion="0" />
                      </damage>
                    </explosionParams>
                  </STriggerableDevicesBehaviorExplosionParams>
                </behavior>
              </STriggerableDevicesTriggerTimerParams>
            </triggers>
            <aiTriggers>
              <STriggerableDevicesTriggerTimerParams name="Explosion Timer" duration="3">
                <behavior>
                  <STriggerableDevicesBehaviorExplosionParams name="Explosion">
                    <explosionParams minRadius="0.25" maxRadius="7" pressure="280">
                      <damage>
                        <DamageInfo DamagePhysical="14" DamageEnergy="0" DamageDistortion="0" />
                      </damage>
                    </explosionParams>
                  </STriggerableDevicesBehaviorExplosionParams>
                </behavior>
              </STriggerableDevicesTriggerTimerParams>
            </aiTriggers>
          </EntityComponentTriggerableDevicesParams>
        </Components>
      </EntityClassDefinition.behr_gren_frag_01>
    `,
  );
  await fs.writeFile(
    manufacturerPath,
    `
      <SCItemManufacturer.BEHR Code="BEHR" __type="SCItemManufacturer" __ref="65a5d887-3b21-4046-a718-6912c0c7c3be" __path="libs/foundry/records/scitemmanufacturer/behr.xml">
        <Localization Name="@manufacturer_NameBEHR" Description="@manufacturer_DescBEHR" />
      </SCItemManufacturer.BEHR>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'throwables',
        csvFile: 'throwable.datacore.csv',
        typeConfig: THROWABLE_TYPE_CONFIG,
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 2,
  });

  const csv = await fs.readFile(path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'throwable.datacore.csv'), 'utf8');

  assert.deepEqual(result.results, [{ type: 'throwables', rows: 1, skipped: 0, csvFile: 'throwable.datacore.csv' }]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Type,Damage Physical,Damage Energy,Damage Distortion,Detonation Delay,Explosion Radius,Explosion Pressure\r?\n/,
  );
  assert.match(
    csv,
    /behr_gren_frag_01,item_Namebehr_frag_grenade_01,item_Namebehr_frag_grenade_01_short,item_Descbehr_frag_grenade_01,BEHR,1,1,Grenade,,Grenade,20,0,0,5,4 - 5\.5,280/,
  );
});

test('runDatacoreScrape can exclude mixed-family rows after extracting DataCore relationship fields', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-exclude-row-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const weaponDir = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'weapons',
    'fps_weapons',
  );
  await fs.mkdir(weaponDir, { recursive: true });
  await fs.writeFile(
    path.join(weaponDir, 'behr_gren_frag_01.xml'),
    `
      <EntityClassDefinition.behr_gren_frag_01 __path="libs/foundry/records/entities/scitem/weapons/fps_weapons/behr_gren_frag_01.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="WeaponPersonal" SubType="Grenade" Size="1" Grade="1" Manufacturer="BEHR">
              <Localization Name="@item_Namebehr_frag_grenade_01" Description="@item_Descbehr_frag_grenade_01" />
            </AttachDef>
          </SAttachableComponentParams>
        </Components>
      </EntityClassDefinition.behr_gren_frag_01>
    `,
  );
  await fs.writeFile(
    path.join(weaponDir, 'behr_pistol_ballistic_01.xml'),
    `
      <EntityClassDefinition.behr_pistol_ballistic_01 __path="libs/foundry/records/entities/scitem/weapons/fps_weapons/behr_pistol_ballistic_01.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="WeaponPersonal" SubType="Ballistic" Size="1" Grade="1" Manufacturer="BEHR">
              <Localization Name="@item_Namebehr_pistol_ballistic_01" Description="@item_Descbehr_pistol_ballistic_01" />
            </AttachDef>
          </SAttachableComponentParams>
          <SCItemWeaponComponentParams>
            <fireActions>
              <SWeaponActionFireSingleParams fireRate="300" aiShootingMode="Single" />
            </fireActions>
          </SCItemWeaponComponentParams>
        </Components>
      </EntityClassDefinition.behr_pistol_ballistic_01>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'weapon-personal',
        csvFile: 'weaponpersonal.datacore.csv',
        typeConfig: WEAPON_PERSONAL_TYPE_CONFIG,
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 2,
  });

  const csv = await fs.readFile(
    path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'weaponpersonal.datacore.csv'),
    'utf8',
  );

  assert.deepEqual(result.results, [
    { type: 'weapon-personal', rows: 1, skipped: 1, csvFile: 'weaponpersonal.datacore.csv' },
  ]);
  assert.match(csv, /behr_pistol_ballistic_01/);
  assert.doesNotMatch(csv, /behr_gren_frag_01/);
});

test('runDatacoreScrape extracts radar stats from signature detection and aim assist params', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-radars-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const radarPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'ships',
    'radar',
    'radr_bltr_s01_prophet.xml',
  );
  const manufacturerPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'scitemmanufacturer', 'bltr.xml');
  await fs.mkdir(path.dirname(radarPath), { recursive: true });
  await fs.mkdir(path.dirname(manufacturerPath), { recursive: true });
  await fs.writeFile(
    radarPath,
    `
      <EntityClassDefinition.RADR_BLTR_S01_Prophet __path="libs/foundry/records/entities/scitem/ships/radar/radr_bltr_s01_prophet.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="Radar" SubType="MidRangeRadar" Size="1" Grade="1" Manufacturer="bcea197e-ac9d-49f4-a692-d77c6927077f">
              <Localization Name="@item_NameRADR_BLTR_S01_Prophet" Description="@item_DescRADR_BLTR_S01_Prophet" />
            </AttachDef>
          </SAttachableComponentParams>
          <SHealthComponentParams Health="460" />
          <signatureParams enable="1" minimumTemperatureForIR="318" temperatureToIR="8" />
          <SDistortionParams DecayDelay="1.5" DecayRate="0.6666667" Maximum="10" />
          <SCItemRadarComponentParams forceActiveAIControlled="0">
            <signatureDetection>
              <SCItemRadarSignatureDetection sensitivity="0.8" piercing="0.25" />
              <SCItemRadarSignatureDetection sensitivity="0.8" piercing="0.25" />
              <SCItemRadarSignatureDetection sensitivity="0.8" piercing="0.25" />
              <SCItemRadarSignatureDetection sensitivity="0" piercing="0.25" />
              <SCItemRadarSignatureDetection sensitivity="1" piercing="1" />
            </signatureDetection>
            <aimAssist distanceMinAssignment="780" distanceMaxAssignment="1122" outsideRangeBufferDistance="60" />
          </SCItemRadarComponentParams>
        </Components>
      </EntityClassDefinition.RADR_BLTR_S01_Prophet>
    `,
  );
  await fs.writeFile(
    manufacturerPath,
    `
      <SCItemManufacturer.BLTR Code="BLTR" __type="SCItemManufacturer" __ref="bcea197e-ac9d-49f4-a692-d77c6927077f" __path="libs/foundry/records/scitemmanufacturer/bltr.xml">
        <Localization Name="@manufacturer_NameBLTR" Description="@manufacturer_DescBLTR" />
      </SCItemManufacturer.BLTR>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'radars',
        csvFile: 'radar.datacore.csv',
        typeConfig: RADAR_TYPE_CONFIG,
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 2,
  });

  const csv = await fs.readFile(path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'radar.datacore.csv'), 'utf8');

  assert.deepEqual(result.results, [{ type: 'radars', rows: 1, skipped: 0, csvFile: 'radar.datacore.csv' }]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Aim Assist Distance \(PiP\) Min,Aim Assist Distance \(PiP\) Max,Aim Assist Distance \(PiP\) Buffer,Sensitivity IR,Sensitivity CS,Sensitivity EM,Sensitivity RS,Sensitivity dB,Piercing IR,Piercing CS,Piercing EM,Piercing RS,Piercing dB,Temperature to IR,Minimum Temperature for IR,Distortion Shutdown Damage,Distortion Decay Delay,Distortion Decay Rate,Distortion Shutdown Time\r?\n/,
  );
  assert.match(
    csv,
    /radr_bltr_s01_prophet,item_NameRADR_BLTR_S01_Prophet,,item_DescRADR_BLTR_S01_Prophet,BLTR,1,1,MidRangeRadar,460,780,1122,60,0\.8,0\.8,0\.8,1,0,0\.25,0\.25,0\.25,1,0\.25,8,318,10,1\.5,0\.6666667,16\.5/,
  );
});

test('runDatacoreScrape extracts turret rotation axis params from real-shaped DataCore XML', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-turrets-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const turretPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'ships',
    'turret',
    'aegs_hammerhead_scitem_turret_rear.xml',
  );
  const bespokeMountPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'ships',
    'weapon_mounts',
    'anvl_arrow_turret.xml',
  );
  const vehicleTurretPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'vehicles',
    'turret',
    'tmbl_storm_main_turret.xml',
  );
  const manufacturerPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'scitemmanufacturer', 'aegs.xml');
  await fs.mkdir(path.dirname(turretPath), { recursive: true });
  await fs.mkdir(path.dirname(bespokeMountPath), { recursive: true });
  await fs.mkdir(path.dirname(vehicleTurretPath), { recursive: true });
  await fs.mkdir(path.dirname(manufacturerPath), { recursive: true });
  await fs.writeFile(
    turretPath,
    `
      <EntityClassDefinition.AEGS_Hammerhead_SCItem_Turret_Rear __path="libs/foundry/records/entities/scitem/ships/turret/aegs_hammerhead_scitem_turret_rear.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="TurretBase" SubType="MannedTurret" Size="5" Grade="1" Manufacturer="cf4a74bf-eb2c-462a-9b78-f7f2724c31d2">
              <Localization Name="@item_Name_Turret_Manned" ShortName="@LOC_EMPTY" Description="@LOC_EMPTY" />
            </AttachDef>
          </SAttachableComponentParams>
          <SCItemTurretParams>
            <movementParams>
              <SCItemTurretJointMovementParams jointName="turret_upper_helper">
                <yawAxis>
                  <SCItemTurretJointMovementAxisParams speed="95" acceleration_timeToFullSpeed="0.3" accelerationDecay="18" />
                </yawAxis>
              </SCItemTurretJointMovementParams>
              <SCItemTurretJointMovementParams jointName="turret_pitch">
                <pitchAxis>
                  <SCItemTurretJointMovementAxisParams speed="95" acceleration_timeToFullSpeed="0.3" accelerationDecay="18" />
                </pitchAxis>
              </SCItemTurretJointMovementParams>
            </movementParams>
          </SCItemTurretParams>
          <SHealthComponentParams Health="15000" />
        </Components>
      </EntityClassDefinition.AEGS_Hammerhead_SCItem_Turret_Rear>
    `,
  );
  await fs.writeFile(
    bespokeMountPath,
    `
      <EntityClassDefinition.ANVL_Arrow_Turret __path="libs/foundry/records/entities/scitem/ships/weapon_mounts/anvl_arrow_turret.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="TurretBase" SubType="RemoteTurret" Size="3" Grade="1" Manufacturer="cf4a74bf-eb2c-462a-9b78-f7f2724c31d2">
              <Localization Name="@item_NameANVL_Arrow_Turret" ShortName="@LOC_EMPTY" Description="@item_DescANVL_Arrow_Turret" />
            </AttachDef>
          </SAttachableComponentParams>
          <SCItemTurretParams>
            <movementParams>
              <SCItemTurretJointMovementParams jointName="turret_upper_helper">
                <yawAxis>
                  <SCItemTurretJointMovementAxisParams speed="50" acceleration_timeToFullSpeed="0.3" accelerationDecay="5" />
                </yawAxis>
              </SCItemTurretJointMovementParams>
              <SCItemTurretJointMovementParams jointName="turret_pitch">
                <pitchAxis>
                  <SCItemTurretJointMovementAxisParams speed="50" acceleration_timeToFullSpeed="0.3" accelerationDecay="5" />
                </pitchAxis>
              </SCItemTurretJointMovementParams>
            </movementParams>
          </SCItemTurretParams>
          <SHealthComponentParams Health="1000" />
        </Components>
      </EntityClassDefinition.ANVL_Arrow_Turret>
    `,
  );
  await fs.writeFile(
    vehicleTurretPath,
    `
      <EntityClassDefinition.TMBL_Storm_Main_Turret __path="libs/foundry/records/entities/scitem/vehicles/turret/tmbl_storm_main_turret.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="TurretBase" SubType="TopTurret" Size="3" Grade="1" Manufacturer="cf4a74bf-eb2c-462a-9b78-f7f2724c31d2">
              <Localization Name="@item_NameTMBL_Storm_Turret" ShortName="@item_DescTMBL_Storm_Turret" Description="@item_Desc_Turret_Remote" />
            </AttachDef>
          </SAttachableComponentParams>
          <SCItemTurretParams>
            <movementParams>
              <SCItemTurretJointMovementParams jointName="turret_upper_helper">
                <yawAxis>
                  <SCItemTurretJointMovementAxisParams speed="100" acceleration_timeToFullSpeed="0.3" accelerationDecay="5" />
                </yawAxis>
              </SCItemTurretJointMovementParams>
              <SCItemTurretJointMovementParams jointName="turret_pitch">
                <pitchAxis>
                  <SCItemTurretJointMovementAxisParams speed="100" acceleration_timeToFullSpeed="0.3" accelerationDecay="5" />
                </pitchAxis>
              </SCItemTurretJointMovementParams>
            </movementParams>
          </SCItemTurretParams>
          <SHealthComponentParams Health="14500" />
        </Components>
      </EntityClassDefinition.TMBL_Storm_Main_Turret>
    `,
  );
  await fs.writeFile(
    manufacturerPath,
    `<SCItemManufacturer.AEGS Code="AEGS" __ref="cf4a74bf-eb2c-462a-9b78-f7f2724c31d2" />`,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [{ name: 'turrets', csvFile: 'turret.datacore.csv', typeConfig: TURRET_TYPE_CONFIG }],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 2,
  });

  const csv = await fs.readFile(path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'turret.datacore.csv'), 'utf8');

  assert.deepEqual(result.results, [{ type: 'turrets', rows: 3, skipped: 0, csvFile: 'turret.datacore.csv' }]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Yaw Speed,Yaw Time To Full Speed,Yaw Accel Decay,Pitch Speed,Pitch Time To Full Speed,Pitch Accel Decay\r?\n/,
  );
  assert.match(
    csv,
    /aegs_hammerhead_scitem_turret_rear,item_Name_Turret_Manned,,,AEGS,5,1,MannedTurret,15000,95,0\.3,18,95,0\.3,18/,
  );
  assert.match(
    csv,
    /anvl_arrow_turret,item_NameANVL_Arrow_Turret,,item_DescANVL_Arrow_Turret,AEGS,3,1,RemoteTurret,1000,50,0\.3,5,50,0\.3,5/,
  );
  assert.match(
    csv,
    /tmbl_storm_main_turret,item_NameTMBL_Storm_Turret,item_DescTMBL_Storm_Turret,item_Desc_Turret_Remote,AEGS,3,1,TopTurret,14500,100,0\.3,5,100,0\.3,5/,
  );
});

test('runDatacoreScrape extracts shield generator params from real-shaped DataCore XML', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-shields-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const shieldPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'ships',
    'shieldgenerator',
    'shld_asas_s02_shroud_scitem.xml',
  );
  const manufacturerPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'scitemmanufacturer', 'asas.xml');
  await fs.mkdir(path.dirname(shieldPath), { recursive: true });
  await fs.mkdir(path.dirname(manufacturerPath), { recursive: true });
  await fs.writeFile(
    shieldPath,
    `
      <EntityClassDefinition.SHLD_ASAS_S02_Shroud_SCItem __path="libs/foundry/records/entities/scitem/ships/shieldgenerator/shld_asas_s02_shroud_scitem.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="Shield" SubType="UNDEFINED" Size="2" Grade="4" Manufacturer="abca0ae0-a819-4aeb-a1a7-f8f1d7e277cf">
              <Localization Name="@item_NameSHLD_ASAS_S02_Shroud" Description="@item_DescSHLD_ASAS_S02_Shroud" />
            </AttachDef>
          </SAttachableComponentParams>
          <SHealthComponentParams Health="350" />
          <SDistortionParams DecayDelay="3" DecayRate="173.3333" Maximum="2600" />
          <SCItemShieldGeneratorParams MaxShieldHealth="9350" MaxShieldRegen="842" ReservePoolMaxHealthRatio="1" ReservePoolRegenRateRatio="1" ReservePoolDrainRateRatio="2.5" DownedRegenDelay="8.47" DamagedRegenDelay="4.24" ElectricalChargeDamageResistance="0">
            <ShieldResistance>
              <SShieldResistance Max="0.25" Min="0" />
              <SShieldResistance Max="-0.27" Min="-0.8" />
              <SShieldResistance Max="0.95" Min="0.75" />
            </ShieldResistance>
            <ShieldAbsorption>
              <SShieldAbsorption Max="0.45" Min="0" />
              <SShieldAbsorption Max="1" Min="1" />
              <SShieldAbsorption Max="1" Min="1" />
            </ShieldAbsorption>
          </SCItemShieldGeneratorParams>
        </Components>
      </EntityClassDefinition.SHLD_ASAS_S02_Shroud_SCItem>
    `,
  );
  await fs.writeFile(
    manufacturerPath,
    `
      <SCItemManufacturer.ASAS Code="ASAS" __type="SCItemManufacturer" __ref="abca0ae0-a819-4aeb-a1a7-f8f1d7e277cf" __path="libs/foundry/records/scitemmanufacturer/asas.xml">
        <Localization Name="@manufacturer_NameASAS" Description="@manufacturer_DescASAS" />
      </SCItemManufacturer.ASAS>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'shields',
        csvFile: 'shield.datacore.csv',
        typeConfig: SHIELD_TYPE_CONFIG,
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 2,
  });

  const csv = await fs.readFile(path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'shield.datacore.csv'), 'utf8');

  assert.deepEqual(result.results, [{ type: 'shields', rows: 1, skipped: 0, csvFile: 'shield.datacore.csv' }]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,HP Pool,Regen Rate,Regen Time,Damaged Delay,Downed Delay,Reserve Max Ratio,Reserve Regen Ratio,Reserve Drain Ratio,Electrical Charge Damage Resistance,Resistance Physical,Resistance Energy,Resistance Distortion,Absorption Physical,Absorption Energy,Absorption Distortion,Distortion Shutdown Damage,Distortion Decay Delay,Distortion Decay Rate,Distortion Shutdown Time\r?\n/,
  );
  assert.match(
    csv,
    /shld_asas_s02_shroud,item_NameSHLD_ASAS_S02_Shroud,,item_DescSHLD_ASAS_S02_Shroud,ASAS,2,4,,350,9350,842,11\.1,4\.24,8\.47,1,1,2\.5,0,25% \/ 0%,-27% \/ -80%,95% \/ 75%,45% \/ 0%,100% \/ 100%,100% \/ 100%,2600,3,173\.3333,18/,
  );
});

test('runDatacoreScrape extracts tractor beam force and towing stats from weapon action params', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-tractor-beams-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const weaponDir = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'entities', 'scitem', 'ships', 'weapons');
  const armDir = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'ships',
    'utility',
    'tractorbeam',
  );
  await fs.mkdir(weaponDir, { recursive: true });
  await fs.mkdir(armDir, { recursive: true });
  await fs.writeFile(
    path.join(weaponDir, 'grin_tractorbeam_s1.xml'),
    `
      <EntityClassDefinition.GRIN_TractorBeam_S1 __path="libs/foundry/records/entities/scitem/ships/weapons/grin_tractorbeam_s1.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="TractorBeam" Size="1" Grade="1" Manufacturer="GRIN">
              <Localization Name="@item_NameGRIN_TractorBeam_002_S1" Description="@item_DescGRIN_TractorBeam_002_shared" />
            </AttachDef>
          </SAttachableComponentParams>
          <SHealthComponentParams Health="1050" />
          <SWeaponActionFireTractorBeamParams minForce="1500" maxForce="500000" minDistance="0.5" maxDistance="150" fullStrengthDistance="75" maxAngle="60" maxVolume="300000" />
        </Components>
      </EntityClassDefinition.GRIN_TractorBeam_S1>
    `,
  );
  await fs.writeFile(
    path.join(weaponDir, 'argo_towingbeam_s3.xml'),
    `
      <EntityClassDefinition.ARGO_TowingBeam_S3 __path="libs/foundry/records/entities/scitem/ships/weapons/argo_towingbeam_s3.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="TowingBeam" Size="3" Grade="1" Manufacturer="GRIN">
              <Localization Name="@item_NameGRIN_TractorBeam_004_S3" Description="@item_DescGRIN_TractorBeam_004_S3" />
            </AttachDef>
          </SAttachableComponentParams>
          <SHealthComponentParams Health="1050" />
          <SWeaponActionFireTractorBeamParams minForce="1500" maxForce="5E+09" minDistance="0.5" maxDistance="300" fullStrengthDistance="200" maxAngle="90" maxVolume="300000">
            <SWeaponActionFireTractorBeamTowingParams towingForce="120000000" towingMaxDistance="125" />
          </SWeaponActionFireTractorBeamParams>
        </Components>
      </EntityClassDefinition.ARGO_TowingBeam_S3>
    `,
  );
  await fs.writeFile(
    path.join(armDir, 'rsi_tractor_beam_arm.xml'),
    `
      <EntityClassDefinition.RSI_Tractor_Beam_Arm __path="libs/foundry/records/entities/scitem/ships/utility/tractorbeam/rsi_tractor_beam_arm.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="TractorBeamArm" Size="2" Grade="1" Manufacturer="RSI" />
          </SAttachableComponentParams>
          <SHealthComponentParams Health="4000" />
        </Components>
      </EntityClassDefinition.RSI_Tractor_Beam_Arm>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'tractor-beams',
        csvFile: 'tractorbeam.datacore.csv',
        typeConfig: TRACTOR_BEAM_TYPE_CONFIG,
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 3,
  });

  const csv = await fs.readFile(
    path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'tractorbeam.datacore.csv'),
    'utf8',
  );

  assert.deepEqual(result.results, [
    { type: 'tractor-beams', rows: 2, skipped: 0, csvFile: 'tractorbeam.datacore.csv' },
  ]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Force,Range,Full Strength Distance,Max Angle,Max Volume,Tow Force,Tow Max Distance\r?\n/,
  );
  assert.match(
    csv,
    /argo_towingbeam_s3,item_NameGRIN_TractorBeam_004_S3,,item_DescGRIN_TractorBeam_004_S3,GRIN,3,1,,1050,0\.0015 - 5000,0\.5 - 300,200,90,300000,120,125/,
  );
  assert.match(
    csv,
    /grin_tractorbeam_s1,item_NameGRIN_TractorBeam_002_S1,,item_DescGRIN_TractorBeam_002_shared,GRIN,1,1,,1050,0\.0015 - 0\.5,0\.5 - 150,75,60,300000,,/,
  );
  assert.doesNotMatch(csv, /tractor_beam_arm/i);
});

test('runDatacoreScrape extracts XML cache when cached records are missing', async () => {
  const events: string[] = [];

  const result = await runDatacoreScrape({
    repoRoot: 'repo',
    dryRun: true,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async (_toolDir, log) => {
      log('tools ready');
      return { unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' };
    },
    countXmlFiles: async () => 0,
    extractXmlCache: async ({ clearExisting }) => {
      assert.equal(clearExisting, false);
      events.push('extract');
      return { workDcbPath: 'cache/Game.dcb', monolithicXmlPath: 'cache/Game.xml', xmlFileCount: 123 };
    },
    onToolsLog: (message) => events.push(message),
    onCacheExtractStart: (_dcbPath, _xmlCacheDir, clearExisting) => {
      assert.equal(clearExisting, false);
      events.push('start');
    },
    onCacheExtractComplete: (count) => events.push(`complete:${count}`),
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.results, []);
  assert.deepEqual(events, ['tools ready', 'start', 'extract', 'complete:123']);
});

test('runDatacoreScrape preserves SCMDB-shaped game version tags', async () => {
  const result = await runDatacoreScrape({
    repoRoot: 'repo',
    dryRun: true,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1-live.11952564',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 0,
    extractXmlCache: async () => ({
      workDcbPath: 'cache/Game.dcb',
      monolithicXmlPath: 'cache/Game.xml',
      xmlFileCount: 123,
    }),
  });

  assert.equal(result.versionTag, '4.8.1-live.11952564');
});

test('runDatacoreScrape refreshes XML cache when cache metadata is for a different game version', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-xml-version-mismatch-'));
  const liveDir = path.join(repoRoot, 'game', 'LIVE');
  const dcbPath = path.join(liveDir, 'Data', 'Game2.dcb');
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live', 'libs');
  await fs.mkdir(path.dirname(dcbPath), { recursive: true });
  await fs.mkdir(xmlCacheDir, { recursive: true });
  await fs.writeFile(dcbPath, 'current dcb');
  await fs.writeFile(path.join(xmlCacheDir, 'old.xml'), '<Old />');
  await fs.writeFile(
    path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live', '.metadata.json'),
    JSON.stringify({ gameVersion: '4.8.0', dcb: null }),
  );

  const events: string[] = [];
  const result = await runDatacoreScrape({
    repoRoot,
    dryRun: true,
    loadTypes: async () => [],
    resolveLiveDir: () => liveDir,
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => dcbPath,
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 7,
    extractXmlCache: async ({ clearExisting }) => {
      events.push(`extract:${clearExisting}`);
      return { workDcbPath: 'cache/Game2.dcb', monolithicXmlPath: 'cache/Game2.xml', xmlFileCount: 123 };
    },
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(events, ['extract:true']);
});

test('DataCore scrape plan reuses record graph only when graph metadata matches cache inputs', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-graph-cache-hit-'));
  const liveDir = path.join(repoRoot, 'game', 'LIVE');
  const dcbPath = path.join(liveDir, 'Data', 'Game2.dcb');
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const outputBase = path.join(repoRoot, 'csv', 'datacore', '4.8.1-live');
  await fs.mkdir(path.dirname(dcbPath), { recursive: true });
  await fs.mkdir(path.join(xmlCacheDir, 'libs'), { recursive: true });
  await fs.mkdir(outputBase, { recursive: true });
  await fs.writeFile(dcbPath, 'stable dcb');
  await fs.writeFile(path.join(xmlCacheDir, 'libs', 'record.xml'), '<Record />');

  const dcbStat = await fs.stat(dcbPath);
  const dcbFingerprint = { size: dcbStat.size, mtimeMs: Math.round(dcbStat.mtimeMs) };
  await fs.writeFile(
    path.join(xmlCacheDir, '.metadata.json'),
    `${JSON.stringify({ gameVersion: '4.8.1', dcb: dcbFingerprint, xmlCache: { fileCount: 1 } })}\n`,
  );
  await fs.writeFile(
    path.join(outputBase, 'record-graph.json'),
    `${JSON.stringify({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    })}\n`,
  );
  await fs.writeFile(
    path.join(outputBase, 'record-graph.metadata.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      generatorVersion: 'datacore-record-graph-v1',
      gameVersion: '4.8.1',
      dcb: dcbFingerprint,
      xmlCache: { fileCount: 1 },
      graph: {
        schemaVersion: 1,
        fidelityMode: 'compact',
        includeAttributes: false,
        includeRawGuidAttributes: true,
        recordCount: 1,
      },
    })}\n`,
  );

  const cacheHits: string[] = [];
  const plan = createDataCoreScrapePlan({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => liveDir,
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => dcbPath,
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => {
      throw new Error('record graph should have been read from cache');
    },
    onRecordGraphCacheHit: (recordCount, outputPath) => cacheHits.push(`${recordCount}:${path.basename(outputPath)}`),
  });

  await plan.prepare();
  await plan.ensureXmlCache();
  const result = await plan.prepareRecordGraph();

  assert.deepEqual(cacheHits, ['1:record-graph.json']);
  assert.deepEqual(result, { recordCount: 1, outputPath: path.join(outputBase, 'record-graph.json'), cached: true });
});

test('DataCore scrape plan rebuilds record graph when graph metadata fidelity is stale', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-graph-cache-miss-'));
  const liveDir = path.join(repoRoot, 'game', 'LIVE');
  const dcbPath = path.join(liveDir, 'Data', 'Game2.dcb');
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const outputBase = path.join(repoRoot, 'csv', 'datacore', '4.8.1-live');
  await fs.mkdir(path.dirname(dcbPath), { recursive: true });
  await fs.mkdir(path.join(xmlCacheDir, 'libs'), { recursive: true });
  await fs.mkdir(outputBase, { recursive: true });
  await fs.writeFile(dcbPath, 'stable dcb');
  await fs.writeFile(path.join(xmlCacheDir, 'libs', 'record.xml'), '<Record />');
  await fs.writeFile(
    path.join(outputBase, 'record-graph.json'),
    `${JSON.stringify({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    })}\n`,
  );

  const dcbStat = await fs.stat(dcbPath);
  const dcbFingerprint = { size: dcbStat.size, mtimeMs: Math.round(dcbStat.mtimeMs) };
  await fs.writeFile(
    path.join(xmlCacheDir, '.metadata.json'),
    `${JSON.stringify({ gameVersion: '4.8.1', dcb: dcbFingerprint, xmlCache: { fileCount: 1 } })}\n`,
  );
  await fs.writeFile(
    path.join(outputBase, 'record-graph.metadata.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      generatorVersion: 'datacore-record-graph-v1',
      gameVersion: '4.8.1',
      dcb: dcbFingerprint,
      xmlCache: { fileCount: 1 },
      graph: {
        schemaVersion: 1,
        fidelityMode: 'full',
        includeAttributes: true,
        includeRawGuidAttributes: true,
        recordCount: 1,
      },
    })}\n`,
  );

  let buildCount = 0;
  const plan = createDataCoreScrapePlan({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => liveDir,
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => dcbPath,
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async (options) => {
      buildCount++;
      assert.equal(options.includeAttributes, false);
      assert.equal(options.includeRawGuidAttributes, true);
      return {
        source: 'datacore-record-graph',
        recordCount: 2,
        records: [],
        indexes: {
          byRef: {},
          byPath: {},
          byRootType: {},
          byEntityClass: {},
          byLocalizationKey: {},
          byReferencedGuid: {},
        },
      };
    },
  });

  await plan.prepare();
  await plan.ensureXmlCache();
  const result = await plan.prepareRecordGraph();
  const metadata = JSON.parse(await fs.readFile(path.join(outputBase, 'record-graph.metadata.json'), 'utf8')) as {
    graph: { fidelityMode: string; includeAttributes: boolean; includeRawGuidAttributes: boolean; recordCount: number };
  };

  assert.equal(buildCount, 1);
  assert.equal(result.cached, false);
  assert.equal(result.recordCount, 2);
  assert.deepEqual(metadata.graph, {
    schemaVersion: 1,
    fidelityMode: 'compact',
    includeAttributes: false,
    includeRawGuidAttributes: true,
    recordCount: 2,
  });
});

test('runDatacoreScrape refreshes repo DCB cache from Data.p4k and invalidates XML cache', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-packed-dcb-'));
  const liveDir = path.join(repoRoot, 'game', 'LIVE');
  const p4kPath = path.join(liveDir, 'Data.p4k');
  const cachedDcbPath = path.join(repoRoot, 'csv', 'datacore', '.dcbcache', '4.8.1-live', 'Data', 'Game2.dcb');
  await fs.mkdir(path.dirname(p4kPath), { recursive: true });
  await fs.mkdir(path.dirname(cachedDcbPath), { recursive: true });
  await fs.writeFile(p4kPath, 'new packed data');
  await fs.writeFile(cachedDcbPath, 'old packed dcb');

  const oldTime = new Date('2026-01-01T00:00:00.000Z');
  const newTime = new Date('2026-06-01T00:00:00.000Z');
  await fs.utimes(cachedDcbPath, oldTime, oldTime);
  await fs.utimes(p4kPath, newTime, newTime);

  const events: string[] = [];
  const result = await runDatacoreScrape({
    repoRoot,
    dryRun: true,
    loadTypes: async () => [],
    resolveLiveDir: () => liveDir,
    readGameVersion: async () => '4.8.1',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 7,
    extractPackedDcb: async (sourceP4k, dcbCacheDir) => {
      events.push(`packed:${sourceP4k}`);
      const target = path.join(dcbCacheDir, 'Data', 'Game2.dcb');
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, 'fresh packed dcb');
    },
    extractXmlCache: async ({ dcbPath, clearExisting }) => {
      events.push(`xml:${dcbPath}:${clearExisting}`);
      return { workDcbPath: 'cache/Game2.dcb', monolithicXmlPath: 'cache/Game2.xml', xmlFileCount: 321 };
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.dcbPath, cachedDcbPath);
  assert.deepEqual(events, [`packed:${p4kPath}`, `xml:${cachedDcbPath}:true`]);
});

test('runDatacoreScrape reports raw fact progress the same way after force-refreshing cache', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-force-progress-'));
  const liveDir = path.join(repoRoot, 'game', 'LIVE');
  const p4kPath = path.join(liveDir, 'Data.p4k');
  await fs.mkdir(path.dirname(p4kPath), { recursive: true });
  await fs.writeFile(p4kPath, 'packed data');

  const progressEvents: string[] = [];
  const result = await runDatacoreScrape({
    repoRoot,
    dryRun: true,
    forceExtract: true,
    loadTypes: async () => [],
    resolveLiveDir: () => liveDir,
    readGameVersion: async () => '4.8.1',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    extractPackedDcb: async (_sourceP4k, dcbCacheDir) => {
      const target = path.join(dcbCacheDir, 'Data', 'Game2.dcb');
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, 'fresh packed dcb');
    },
    countXmlFiles: async () => 7,
    extractXmlCache: async ({ clearExisting }) => {
      assert.equal(clearExisting, true);
      return { workDcbPath: 'cache/Game2.dcb', monolithicXmlPath: 'cache/Game2.xml', xmlFileCount: 321 };
    },
    extractContractGenerators: async (options) => {
      options.onProgress?.(1, 3);
      return [];
    },
    onRawFactStart: (slug, total) => progressEvents.push(`start:${slug}:${total}`),
    onRawFactProgress: (slug, current, total) => progressEvents.push(`progress:${slug}:${current}:${total}`),
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(progressEvents.slice(0, 2), ['start:contract-generators:3', 'progress:contract-generators:1:3']);
});

test('runDatacoreScrape writes DataCore commodity CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-commodities-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [
      {
        ref: 'af5dcf22-7a28-4b1e-88f0-4309d34be11a',
        path: 'libs/foundry/records/entities/commodities/alloys/atlasium.xml',
        entityClass: 'atlasium',
        nameKey: 'items_commodities_atlasium',
        descriptionKey: 'items_commodities_atlasium_desc',
        displayNameKey: 'items_commodities_atlasium',
        displayDescriptionKey: 'items_commodities_atlasium_desc',
        displayTypeKey: 'items_commodities_type_alloy',
        typeGuid: '22325f28-8d37-46ab-8c08-8a9b34101fad',
        subtypeGuid: '45f89d34-3167-4723-9b85-f9df3770ce00',
        cargoOccupancyUnit: 'SCentiCargoUnit',
        cargoOccupancyValue: '1',
        cargoOccupancySCU: '0.01',
        boxable: '1',
        isUnrefinedElement: '0',
        isRaw: '',
        isRefined: '1',
        controlledSubstanceJurisdictions: '',
        controlledSubstanceMaxScu: '',
        legalityWarningSource: '',
      },
    ],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'commodities.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.commodityResult.rows, 1);
  assert.equal(result.commodityResult.csvFile, 'commodities.datacore.csv');
  assert.match(
    csv,
    /^Entity Class,Name Key,Description Key,Display Name Key,Display Description Key,Display Type Key,Type GUID,Subtype GUID,Cargo Occupancy Unit,Cargo Occupancy Value,Cargo Occupancy SCU,Boxable,Unrefined,Raw,Refined,Controlled Substance Jurisdictions,Controlled Substance Max SCU,Legality Warning Source,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /atlasium,items_commodities_atlasium,items_commodities_atlasium_desc/);
});

test('runDatacoreScrape writes DataCore vehicle CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-vehicles-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractVehicles: async () => [
      {
        ref: '11111111-1111-1111-1111-111111111111',
        path: 'libs/foundry/records/entities/spaceships/aegs_avenger_titan.xml',
        entityClass: 'AEGS_Avenger_Titan',
        vehicleNameKey: 'vehicle_NameAEGS_Avenger_Titan',
        vehicleDescriptionKey: 'vehicle_DescAEGS_Avenger_Titan',
        manufacturerGuid: 'cf4a74bf-eb2c-462a-9b78-f7f2724c31d2',
        manufacturerCode: 'AEGS',
        manufacturerNameKey: 'manufacturer_NameAEGS',
        movementClass: 'Spaceship',
        vehicleDefinition: 'scripts/entities/vehicles/implementations/xml/aegs_avenger.xml',
        modification: 'Titan',
        careerKey: 'vehicle_focus_transporter',
        careerGuid: 'd86d770d-1fc4-4525-b3b0-4f670a8a5634',
        roleKey: 'vehicle_class_lightfreight',
        roleGuid: 'ff99d78e-3a6a-4e4d-8b1c-59e87a005c11',
        crewSize: '1',
        hullDamageNormalization: '1650',
        allowSoftDestruction: '1',
        dogfightEnabled: '1',
        isGravlevVehicle: '0',
        inventoryContainerGuid: 'a623a5e1-27db-4e93-af6b-e54912b78e32',
      },
    ],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'vehicles.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.vehicleResult.rows, 1);
  assert.equal(result.vehicleResult.csvFile, 'vehicles.datacore.csv');
  assert.match(
    csv,
    /^Entity Class,Vehicle Name Key,Vehicle Description Key,Manufacturer GUID,Manufacturer Code,Manufacturer Name Key,Movement Class,Vehicle Definition,Modification,Career Key,Career GUID,Role Key,Role GUID,Crew Size,Hull Damage Normalization,Allow Soft Destruction,Dogfight Enabled,Gravlev Vehicle,Inventory Container GUID,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /AEGS_Avenger_Titan,vehicle_NameAEGS_Avenger_Titan,vehicle_DescAEGS_Avenger_Titan/);
});

test('runDatacoreScrape writes DataCore faction CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-factions-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractVehicles: async () => [],
    extractFactions: async () => [
      {
        ref: '9f89edc0-441b-4f40-a502-df12ebf3f1eb',
        path: 'libs/foundry/records/factions/faction_reputation_unlawful_headhunters.xml',
        factionClass: 'Faction_Reputation_Unlawful_HeadHunters',
        nameKey: 'HeadHunters_RepUI_Name',
        descriptionKey: 'HeadHunters_RepUI_Description',
        defaultReaction: 'Neutral',
        factionType: 'Unlawful',
        ableToArrest: '0',
        policesLawfulTrespass: '0',
        policesCriminality: '0',
        noLegalRights: '0',
        factionReputationGuid: '09efeef4-c646-408d-a979-3ae56a3b1beb',
        factionReputationClass: 'FactionReputation_HeadHunters',
        factionReputationPath: 'libs/foundry/records/factions/factionreputation/factionreputation_headhunters.xml',
        reputationDisplayNameKey: 'HeadHunters_RepUI_Name',
        reputationDescriptionKey: 'HeadHunters_RepUI_Description',
        reputationHeadquartersKey: 'HeadHunters_RepUI_Headquarters',
        reputationFoundedKey: '',
        reputationLeadershipKey: '',
        reputationAreaKey: '',
        reputationFocusKey: 'HeadHunters_RepUI_Focus',
        reputationLawful: '0',
        alliedFactionGuids: '3c9a42a9-a986-494f-b724-4d74415f6016',
        enemyFactionGuids: '14789370-bf3a-42b9-ac55-a49ee406e1f1;cd2b32d1-0362-41fb-8cfd-d29781daf789',
      },
    ],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'factions.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.factionResult.rows, 1);
  assert.equal(result.factionResult.csvFile, 'factions.datacore.csv');
  assert.match(
    csv,
    /^Faction Class,Name Key,Description Key,Default Reaction,Faction Type,Able To Arrest,Polices Lawful Trespass,Polices Criminality,No Legal Rights,Faction Reputation GUID,Faction Reputation Class,Faction Reputation Path,Reputation Display Name Key,Reputation Description Key,Reputation Headquarters Key,Reputation Founded Key,Reputation Leadership Key,Reputation Area Key,Reputation Focus Key,Reputation Lawful,Allied Faction GUIDs,Enemy Faction GUIDs,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /Faction_Reputation_Unlawful_HeadHunters,HeadHunters_RepUI_Name/);
});

test('runDatacoreScrape writes DataCore manufacturer CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-manufacturers-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractVehicles: async () => [],
    extractFactions: async () => [],
    extractManufacturers: async () => [
      {
        ref: 'cf4a74bf-eb2c-462a-9b78-f7f2724c31d2',
        path: 'libs/foundry/records/scitemmanufacturer/scitemmanufacturer.aegs.xml',
        manufacturerClass: 'AEGS',
        code: 'AEG',
        nameKey: 'manufacturer_NameAEGS',
        shortNameKey: '',
        descriptionKey: 'manufacturer_DescAEGS',
        logo: 'UI/SharedAssets/ManufacturerLogos/Aegis_256.tif',
        logoFullColor: 'ui/textures/logos/logo_corp_aegs_square_color.tif',
        logoSimplifiedWhite: 'ui/textures/logos/logo_corp_aegs_square_white.tif',
        dashboardCanvasConfigGuid: '3db6a90f-4e32-40b5-b583-da02478b1f69',
        buildingBlocksStyleGuid: 'bcf008bc-19c3-4fc5-8629-9f18e462dbe0',
        audioManufacturerTagGuid: '3a4880d2-c4d7-4b78-a5ab-bd9a54fd3e5f',
        lightAmplificationGuid: '41883412-2a2c-47a0-b5a9-c0f40e3fed63',
      },
    ],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'manufacturers.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.manufacturerResult.rows, 1);
  assert.equal(result.manufacturerResult.csvFile, 'manufacturers.datacore.csv');
  assert.match(
    csv,
    /^Manufacturer Class,Code,Name Key,Short Name Key,Description Key,Logo,Logo Full Color,Logo Simplified White,Dashboard Canvas Config GUID,Building Blocks Style GUID,Audio Manufacturer Tag GUID,Light Amplification GUID,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /AEGS,AEG,manufacturer_NameAEGS,,manufacturer_DescAEGS/);
});

test('runDatacoreScrape writes DataCore location label CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-location-labels-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractVehicles: async () => [],
    extractFactions: async () => [],
    extractManufacturers: async () => [],
    extractLocationLabels: async () => [
      {
        ref: '407847a6-4aae-4c3c-9a36-b80108d776f0',
        path: 'libs/foundry/records/starmap/pu/pyro3_outpost.xml',
        locationClass: 'Pyro3_Outpost',
        nameKey: 'Pyro3_Outpost',
        descriptionKey: 'Pyro3_Outpost_desc',
        callout1Key: 'Pyro3_Outpost_callout1',
        callout2Key: '',
        callout3Key: '',
        typeGuid: 'e207a1ec-1395-4c1c-8e51-b38c4420784c',
        parentGuid: '59637d5a-c67a-47eb-96dc-b648298f0023',
        parentClass: 'Pyro3',
        parentPath: 'libs/foundry/records/starmap/pu/system/pyro/pyro3.xml',
        affiliationGuid: '6f3699dd-123e-4f1a-82da-51207b073fe0',
        affiliationClass: 'HeadHunters',
        affiliationPath: 'libs/foundry/records/factions_legacy/headhunters.xml',
        affiliationNameKey: 'HeadHunters_RepUI_Name',
        jurisdictionGuid: '0d2e5d5e-a3d3-4a6d-869f-58dc705e7020',
        jurisdictionClass: 'XenoThreat',
        jurisdictionPath: 'libs/foundry/records/lawsystem/jurisdictions/pyro/xenothreat.xml',
        jurisdictionNameKey: 'Xenothreat_RepUI_Name',
        respawnLocationType: 'None',
        locationHierarchyTag: 'cd99a4ac-aeba-43f1-8edd-4f050d50b1bc',
        navIcon: 'Outpost',
        size: '1',
        hideInStarmap: '0',
        hideInWorld: '0',
        hideWhenInAdoptionRadius: '0',
        onlyShowWhenParentSelected: '1',
        overrideShowInAllZones: 'NoOverride',
        overridePermanent: 'NoOverride',
        minimumDisplaySize: '0',
        blockTravel: '0',
        isScannable: '0',
        showOrbitLine: '0',
        useHoloMaterial: '1',
        noAutoBodyRecovery: '0',
        arrivalRadius: '2500',
        adoptionRadius: '1500',
        setEntityLocationOnEnter: '1',
        exposeForPlayerCreatedMissions: '0',
        starMapGeomPath: 'objects/ui/starmap/icon_nav_marker_outpost_1_a.cgf',
        starMapMaterialPath: 'objects/ui/starmap/icon_nav_marker_outpost.mtl',
        starMapShapePath: 'UI/Textures/Vector/General/MarkerIcons/ui_icon_general_01.svg',
        locationImagePath: 'UI/Frontend/assets/TIF/Locations/Pyro_Outpost.tif',
      },
    ],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'location-labels.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.locationLabelResult.rows, 1);
  assert.equal(result.locationLabelResult.csvFile, 'location-labels.datacore.csv');
  assert.match(
    csv,
    /^Location Class,Name Key,Description Key,Callout 1 Key,Callout 2 Key,Callout 3 Key,Type GUID,Parent GUID,Parent Class,Parent Path,Affiliation GUID,Affiliation Class,Affiliation Path,Affiliation Name Key,Jurisdiction GUID,Jurisdiction Class,Jurisdiction Path,Jurisdiction Name Key,Respawn Location Type,Location Hierarchy Tag,Nav Icon,Size,Hide In Starmap,Hide In World,Hide When In Adoption Radius,Only Show When Parent Selected,Override Show In All Zones,Override Permanent,Minimum Display Size,Block Travel,Is Scannable,Show Orbit Line,Use Holo Material,No Auto Body Recovery,Arrival Radius,Adoption Radius,Set Entity Location On Enter,Expose For Player Created Missions,StarMap Geom Path,StarMap Material Path,StarMap Shape Path,Location Image Path,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /Pyro3_Outpost,Pyro3_Outpost,Pyro3_Outpost_desc/);
  assert.match(csv, /XenoThreat,libs\/foundry\/records\/lawsystem\/jurisdictions\/pyro\/xenothreat\.xml/);
});

test('runDatacoreScrape writes DataCore mining element CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-elements-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [
      {
        ref: 'd61d6c33-e428-4014-9326-0b06034de16a',
        path: 'libs/foundry/records/mining/mineableelements/agricium_ore.xml',
        elementClass: 'Agricium_Ore',
        elementName: 'Agricium (Ore)',
        materialName: 'Agricium',
        inferredDescriptionKey: 'items_commodities_agricium_ore_desc',
        resourceTypeGuid: 'fc1ec740-3047-48d8-81f0-396f4c9a90ef',
        instability: '350',
        resistance: '0.5',
        optimalWindowMidpoint: '0.5',
        optimalWindowRandomness: '0.15',
        optimalWindowThinness: '2',
        explosionMultiplier: '4',
        clusterFactor: '0.2',
      },
    ],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'mining-elements.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningElementResult.rows, 1);
  assert.equal(result.miningElementResult.csvFile, 'mining-elements.datacore.csv');
  assert.match(
    csv,
    /^Element Class,Element Name,Material Name,Inferred Description Key,Resource Type GUID,Instability,Resistance,Optimal Window Midpoint,Optimal Window Randomness,Optimal Window Thinness,Explosion Multiplier,Cluster Factor,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /Agricium_Ore,Agricium \(Ore\),Agricium,items_commodities_agricium_ore_desc/);
});

test('runDatacoreScrape writes DataCore mining composition CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-compositions-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [
      {
        ref: '3a6e7bb4-0f23-4c46-b822-333afe9d63ab',
        path: 'libs/foundry/records/mining/rockcompositionpresets/asteroid_ctype_aluminium.xml',
        compositionClass: 'Asteroid_CType_Aluminium',
        depositNameKey: 'hud_mining_asteroid_name_5',
        minimumDistinctElements: '2',
        partIndex: '0',
        mineableElementGuid: '3776294d-5689-41f2-b03d-e8fcd17ede6a',
        mineableElementClass: 'Aluminium_Ore',
        mineableElementName: 'Aluminum (Ore)',
        minPercentage: '30',
        maxPercentage: '70',
        probability: '1',
        curveExponent: '1',
        qualityScale: '1',
      },
    ],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'mining-compositions.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningCompositionResult.rows, 1);
  assert.equal(result.miningCompositionResult.csvFile, 'mining-compositions.datacore.csv');
  assert.match(
    csv,
    /^Composition Class,Deposit Name Key,Minimum Distinct Elements,Part Index,Mineable Element GUID,Mineable Element Class,Mineable Element Name,Min Percentage,Max Percentage,Probability,Curve Exponent,Quality Scale,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /Asteroid_CType_Aluminium,hud_mining_asteroid_name_5,2,0/);
});

test('runDatacoreScrape writes DataCore mining provider preset CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-provider-presets-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [],
    extractMiningProviderPresets: async () => [
      {
        ref: '449763d3-5ba2-4a97-873d-cedf802b9aea',
        path: 'libs/foundry/records/harvestable/providerpresets/system/stanton/hpp_stanton1.xml',
        providerClass: 'HPP_Stanton1',
        system: 'stanton',
        location: 'hpp_stanton1',
        groupName: 'SpaceShip_Mineables',
        groupProbability: '6',
        entryIndex: '0.0',
        harvestableGuid: 'e576319a-80bf-46a6-b600-ab4d5e34c00f',
        harvestableClass: 'AgriciumRock',
        harvestablePath: 'libs/foundry/records/entities/mineable/agriciumrock.xml',
        harvestableEntityGuid: '1c949ce0-c99b-485b-b783-2ea3b49162c0',
        harvestableEntityClass: 'AgriciumRock',
        harvestableEntityPath: 'libs/foundry/records/entities/mineable/agriciumrock.xml',
        harvestableSetupGuid: '',
        harvestableSetupClass: '',
        compositionGuid: '3a6e7bb4-0f23-4c46-b822-333afe9d63ab',
        compositionClass: 'Asteroid_CType_Aluminium',
        globalParamsGuid: 'aa727a56-9937-4eb5-80c6-51b418d43177',
        audioParamsGuid: '5f5c1a61-6500-46a1-8a01-7ba4956751d1',
        filledFactor: '1',
        clusteringGuid: '70128b72-7c50-4315-bed8-59a1c2ef7996',
        clusteringClass: 'Asteroid_Lrg_Med_Sml',
        relativeProbability: '44',
        geometryTags: '6874072c-c021-43bc-b8d9-d06b810102c5',
      },
    ],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'mining-provider-presets.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningProviderPresetResult.rows, 1);
  assert.equal(result.miningProviderPresetResult.csvFile, 'mining-provider-presets.datacore.csv');
  assert.match(
    csv,
    /^Provider Class,System,Location,Group Name,Group Probability,Entry Index,Harvestable GUID,Harvestable Class,Harvestable Path,Harvestable Entity GUID,Harvestable Entity Class,Harvestable Entity Path,Harvestable Setup GUID,Harvestable Setup Class,Composition GUID,Composition Class,Global Params GUID,Audio Params GUID,Filled Factor,Clustering GUID,Clustering Class,Relative Probability,Geometry Tags,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /HPP_Stanton1,stanton,hpp_stanton1,SpaceShip_Mineables,6,0\.0/);
});

test('runDatacoreScrape writes DataCore mineable entity CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mineable-entities-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [],
    extractMineableEntities: async () => [
      {
        ref: '6b582444-50ec-47fe-8c5f-a342e38506f3',
        path: 'libs/foundry/records/entities/mineable/asteroidctypemineablerock_aluminium.xml',
        entityClass: 'AsteroidCTypeMineableRock_Aluminium',
        compositionGuid: '3a6e7bb4-0f23-4c46-b822-333afe9d63ab',
        compositionClass: 'Asteroid_CType_Aluminium',
        globalParamsGuid: 'aa727a56-9937-4eb5-80c6-51b418d43177',
        globalParamsClass: 'MiningGlobalParams_Ship',
        audioParamsGuid: '5f5c1a61-6500-46a1-8a01-7ba4956751d1',
        audioParamsClass: 'MiningAudioParams_Ship',
        densityClassGuid: '6e889f53-d6bc-4b3e-80c5-875376e02194',
        densityClass: 'EntityDensityClass_Mineable',
        filledFactor: '1',
        glowCurvePower: '1',
        glowLerpSpeed: '0.25',
        allowAutoRespawning: '1',
      },
    ],
    extractMiningProviderPresets: async () => [],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'mineable-entities.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.mineableEntityResult.rows, 1);
  assert.equal(result.mineableEntityResult.csvFile, 'mineable-entities.datacore.csv');
  assert.match(
    csv,
    /^Entity Class,Composition GUID,Composition Class,Global Params GUID,Global Params Class,Audio Params GUID,Audio Params Class,Density Class GUID,Density Class,Filled Factor,Glow Curve Power,Glow Lerp Speed,Allow Auto Respawning,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /AsteroidCTypeMineableRock_Aluminium,3a6e7bb4-0f23-4c46-b822-333afe9d63ab/);
});

test('runDatacoreScrape writes DataCore mining density override CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-density-overrides-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [],
    extractMineableEntities: async () => [],
    extractMiningDensityOverrides: async () => [
      {
        ref: 'ad7b50ff-f32b-4156-a56e-f0ddfc48f76d',
        path: 'libs/foundry/records/densityclasses/overrides/stanton_hightechminingoutpost.xml',
        overrideClass: 'Stanton_HighTechMiningOutpost',
        densityClassGuid: 'b6cc39fd-7c14-4568-b261-197834e51116',
        densityClass: 'SpaceShipDensityClass',
        densityClassPath: 'libs/foundry/records/densityclasses/spaceshipdensityclass.xml',
        lifetimeDays: '0',
        lifetimeHours: '20',
        lifetimeMinutes: '0',
        lifetimeSeconds: '0',
        lifetimeTotalSeconds: '72000',
      },
    ],
    extractMiningProviderPresets: async () => [],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'mining-density-overrides.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningDensityOverrideResult.rows, 1);
  assert.equal(result.miningDensityOverrideResult.csvFile, 'mining-density-overrides.datacore.csv');
  assert.match(
    csv,
    /^Override Class,Density Class GUID,Density Class,Density Class Path,Lifetime Days,Lifetime Hours,Lifetime Minutes,Lifetime Seconds,Lifetime Total Seconds,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /Stanton_HighTechMiningOutpost,b6cc39fd-7c14-4568-b261-197834e51116/);
});

test('runDatacoreScrape writes DataCore mining clustering CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-clustering-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [],
    extractMineableEntities: async () => [],
    extractMiningClustering: async () => [
      {
        ref: '70128b72-7c50-4315-bed8-59a1c2ef7996',
        path: 'libs/foundry/records/harvestable/clusteringpresets/asteroid_lrg_med_sml.xml',
        clusteringClass: 'Asteroid_Lrg_Med_Sml',
        probabilityOfClustering: '10',
        paramIndex: '0',
        relativeProbability: '0.1',
        minSize: '4',
        maxSize: '5',
        minProximity: '5',
        maxProximity: '15',
      },
    ],
    extractMiningProviderPresets: async () => [],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'mining-clustering.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningClusteringResult.rows, 1);
  assert.equal(result.miningClusteringResult.csvFile, 'mining-clustering.datacore.csv');
  assert.match(
    csv,
    /^Clustering Class,Probability Of Clustering,Param Index,Relative Probability,Min Size,Max Size,Min Proximity,Max Proximity,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /Asteroid_Lrg_Med_Sml,10,0,0\.1,4,5,5,15/);
});

test('runDatacoreScrape writes DataCore mining harvestable preset CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-harvestable-presets-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [],
    extractMineableEntities: async () => [],
    extractMiningClustering: async () => [],
    extractMiningHarvestablePresets: async () => [
      {
        ref: 'b4dbb414-4946-437a-870b-0df49007603b',
        path: 'libs/foundry/records/harvestable/harvestablepresets/fpsmining_aphorite.xml',
        harvestablePresetClass: 'FPSMining_Aphorite',
        harvestableEntityGuid: 'ac63f486-e582-473c-b08b-57e446092af0',
        harvestableEntityClass: 'AphoriteMineableRockFPS',
        harvestableEntityPath: 'libs/foundry/records/entities/mineable/aphoritemineablerockfps.xml',
        respawnInSlotTime: '3600',
        specialHarvestableString: '',
      },
    ],
    extractMiningProviderPresets: async () => [],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'mining-harvestable-presets.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningHarvestablePresetResult.rows, 1);
  assert.equal(result.miningHarvestablePresetResult.csvFile, 'mining-harvestable-presets.datacore.csv');
  assert.match(
    csv,
    /^Harvestable Preset Class,Harvestable Entity GUID,Harvestable Entity Class,Harvestable Entity Path,Respawn In Slot Time,Special Harvestable String,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /FPSMining_Aphorite,ac63f486-e582-473c-b08b-57e446092af0,AphoriteMineableRockFPS/);
});

test('runDatacoreScrape writes DataCore mining harvestable setup CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-harvestable-setups-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [],
    extractMineableEntities: async () => [],
    extractMiningClustering: async () => [],
    extractMiningHarvestablePresets: async () => [],
    extractMiningHarvestableSetups: async () => [
      {
        ref: '0aa9921e-8de0-487e-bc87-1d457c56d74f',
        path: 'libs/foundry/records/harvestable/harvestablesetups/mineablerockharvestablesetup.xml',
        setupClass: 'MineableRockHarvestableSetup',
        respawnInSlotTime: '3600',
        specialHarvestableString: '',
        harvestConditionTypes: 'HarvestConditionHealth',
        healthRatio: '0',
        includeAttachedChildren: '',
        allInteractionsClearSpawnPoint: '',
        movementDistance: '',
        despawnTimeSeconds: '600',
        additionalWaitForNearbyPlayersSeconds: '300',
        minScale: '1',
        maxScale: '1',
        terrainNormalAlignment: '1',
        minZOffset: '0',
        maxZOffset: '0',
        minSlope: '0',
        maxSlope: '90',
        minElevation: '-10000',
        maxElevation: '10000',
        localRotationOffset: '0,0,0',
        rotationRange: '0,0,360',
        positionOffset: '0,0,0',
      },
    ],
    extractMiningProviderPresets: async () => [],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'mining-harvestable-setups.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningHarvestableSetupResult.rows, 1);
  assert.equal(result.miningHarvestableSetupResult.csvFile, 'mining-harvestable-setups.datacore.csv');
  assert.match(
    csv,
    /^Setup Class,Respawn In Slot Time,Special Harvestable String,Harvest Condition Types,Health Ratio,Include Attached Children,All Interactions Clear Spawn Point,Movement Distance,Despawn Time Seconds,Additional Wait For Nearby Players Seconds,Min Scale,Max Scale,Terrain Normal Alignment,Min Z Offset,Max Z Offset,Min Slope,Max Slope,Min Elevation,Max Elevation,Local Rotation Offset,Rotation Range,Position Offset,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /MineableRockHarvestableSetup,3600,,HarvestConditionHealth,0/);
});

test('runDatacoreScrape writes DataCore mining sub-harvestable config CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-sub-harvestable-configs-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [],
    extractMineableEntities: async () => [],
    extractMiningClustering: async () => [],
    extractMiningHarvestablePresets: async () => [],
    extractMiningHarvestableSetups: async () => [],
    extractMiningSubHarvestableConfigs: async () => [
      {
        ref: '22222222-2222-2222-2222-222222222222',
        path: 'libs/foundry/records/harvestable/slotpresets/cave_prison_harvestables.xml',
        configClass: 'Cave_Prison_Harvestables',
        configType: 'multi-manual',
        taggedConfigName: 'FPS mineables',
        tagGuids: '4ae42675-463a-47fc-a90a-069b05796920',
        initialSlotsProbability: '0.7',
        configRespawnTimeMultiplier: '1',
        slotIndex: '0',
        harvestableGuid: 'b4dbb414-4946-437a-870b-0df49007603b',
        harvestableClass: 'FPSMining_Aphorite',
        harvestablePath: 'libs/foundry/records/harvestable/harvestablepresets/fpsmining_aphorite.xml',
        harvestableEntityGuid: 'ac63f486-e582-473c-b08b-57e446092af0',
        harvestableEntityClass: 'AphoriteMineableRockFPS',
        harvestableEntityPath: 'libs/foundry/records/entities/mineable/aphoritemineablerockfps.xml',
        harvestableSetupGuid: '0aa9921e-8de0-487e-bc87-1d457c56d74f',
        harvestableSetupClass: 'MineableRockHarvestableSetup',
        relativeProbability: '0.4',
        deepestRelativeProbability: '',
        harvestableRespawnTimeMultiplier: '1',
        geometryTags: '9c6ef328-5118-4882-9ad4-2f391322af21',
        referencedConfigGuid: '',
        referencedConfigClass: '',
        referencedConfigPath: '',
      },
    ],
    extractMiningProviderPresets: async () => [],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'mining-sub-harvestable-configs.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningSubHarvestableConfigResult.rows, 1);
  assert.equal(result.miningSubHarvestableConfigResult.csvFile, 'mining-sub-harvestable-configs.datacore.csv');
  assert.match(
    csv,
    /^Config Class,Config Type,Tagged Config Name,Tag GUIDs,Initial Slots Probability,Config Respawn Time Multiplier,Slot Index,Harvestable GUID,Harvestable Class,Harvestable Path,Harvestable Entity GUID,Harvestable Entity Class,Harvestable Entity Path,Harvestable Setup GUID,Harvestable Setup Class,Relative Probability,Deepest Relative Probability,Harvestable Respawn Time Multiplier,Geometry Tags,Referenced Config GUID,Referenced Config Class,Referenced Config Path,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /Cave_Prison_Harvestables,multi-manual,FPS mineables/);
});

test('runDatacoreScrape writes DataCore mining quality distribution CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-quality-distributions-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [],
    extractMineableEntities: async () => [],
    extractMiningClustering: async () => [],
    extractMiningHarvestablePresets: async () => [],
    extractMiningHarvestableSetups: async () => [],
    extractMiningSubHarvestableConfigs: async () => [],
    extractMiningQualityDistributions: async () => [
      {
        ref: '6b3f9232-d6f7-4ce9-8c30-f21aab55f073',
        path: 'libs/foundry/records/crafting/qualitydistribution/shipmineables/commonshipmineable_qualityoverride_pyro.xml',
        distributionClass: 'CommonShipMineable_QualityOverride_Pyro',
        distributionType: 'location-override',
        mineableFamily: 'shipmineables',
        locationGuid: '286cb603-b4ae-4279-80a1-d4505fee1916',
        locationClass: 'PyroSolarSystem',
        locationPath: 'libs/foundry/records/starmap/pu/pyrosolarsystem.xml',
        minQuality: '501',
        maxQuality: '1000',
        mean: '104',
        stddev: '214',
      },
    ],
    extractMiningProviderPresets: async () => [],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'mining-quality-distributions.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningQualityDistributionResult.rows, 1);
  assert.equal(result.miningQualityDistributionResult.csvFile, 'mining-quality-distributions.datacore.csv');
  assert.match(
    csv,
    /^Distribution Class,Distribution Type,Mineable Family,Location GUID,Location Class,Location Path,Min Quality,Max Quality,Mean,Stddev,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /CommonShipMineable_QualityOverride_Pyro,location-override,shipmineables/);
});

test('runDatacoreScrape writes DataCore mining quality quantization CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-quality-quantizations-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [],
    extractMineableEntities: async () => [],
    extractMiningClustering: async () => [],
    extractMiningHarvestablePresets: async () => [],
    extractMiningHarvestableSetups: async () => [],
    extractMiningSubHarvestableConfigs: async () => [],
    extractMiningQualityDistributions: async () => [],
    extractMiningQualityQuantizations: async () => [
      {
        ref: 'e2b8bf3d-deff-4433-8c2e-e2d728db88d0',
        path: 'libs/foundry/records/crafting/qualityquantization/quantization_agricium.xml',
        quantizationClass: 'Quantization_Agricium',
        elementToken: 'Agricium',
        qualityBands: '346 / 588 / 1000',
        bandRanges: '0-399:346 / 400-599:588 / 999-1000:1000',
      },
    ],
    extractMiningProviderPresets: async () => [],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'mining-quality-quantizations.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningQualityQuantizationResult.rows, 1);
  assert.equal(result.miningQualityQuantizationResult.csvFile, 'mining-quality-quantizations.datacore.csv');
  assert.match(csv, /^Quantization Class,Element Token,Quality Bands,Band Ranges,Record GUID,Record Path\r?\n/);
  assert.match(csv, /Quantization_Agricium,Agricium,346 \/ 588 \/ 1000/);
});

test('runDatacoreScrape writes DataCore mining location label CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-location-labels-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [],
    extractMineableEntities: async () => [],
    extractMiningClustering: async () => [],
    extractMiningHarvestablePresets: async () => [],
    extractMiningHarvestableSetups: async () => [],
    extractMiningSubHarvestableConfigs: async () => [],
    extractMiningQualityDistributions: async () => [],
    extractMiningLocationLabels: async () => [
      {
        ref: '544034db-6fde-44b4-aba8-c2ea35421ccd',
        path: 'libs/foundry/records/starmap/pu/asteroidcluster_miningbase_pyro_regiona_medium_01.xml',
        locationClass: 'AsteroidCluster_MiningBase_Pyro_RegionA_Medium_01',
        sourceReason: 'class-or-path-mining',
        nameKey: 'ab_mine_pyro_regiona_med_001',
        descriptionKey: 'ab_mine_pyro_desc',
        callout1Key: 'LOC_UNINITIALIZED',
        callout2Key: '',
        callout3Key: '',
        typeGuid: 'e60452a5-b85c-4ab1-97e7-9cefb466f87b',
        parentGuid: 'a14bec87-5801-4440-8ca8-35597487ac9a',
        parentClass: 'PyroAsteroidBelt',
        parentPath: 'libs/foundry/records/starmap/pu/pyroasteroidbelt.xml',
        locationHierarchyTag: '812520ca-5f0a-4e88-9649-91237b1e4e51',
        navIcon: 'Default',
        size: '400',
        hideInStarmap: '0',
        hideInWorld: '0',
        isScannable: '0',
        blockTravel: '0',
        arrivalRadius: '18000',
        adoptionRadius: '20000',
        setEntityLocationOnEnter: '1',
        exposeForPlayerCreatedMissions: '0',
      },
    ],
    extractMiningParams: async () => [],
    extractMiningProviderPresets: async () => [],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'mining-location-labels.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningLocationLabelResult.rows, 1);
  assert.equal(result.miningLocationLabelResult.csvFile, 'mining-location-labels.datacore.csv');
  assert.match(
    csv,
    /^Location Class,Source Reason,Name Key,Description Key,Callout 1 Key,Callout 2 Key,Callout 3 Key,Type GUID,Parent GUID,Parent Class,Parent Path,Location Hierarchy Tag,Nav Icon,Size,Hide In Starmap,Hide In World,Is Scannable,Block Travel,Arrival Radius,Adoption Radius,Set Entity Location On Enter,Expose For Player Created Missions,Record GUID,Record Path\r?\n/,
  );
  assert.match(
    csv,
    /AsteroidCluster_MiningBase_Pyro_RegionA_Medium_01,class-or-path-mining,ab_mine_pyro_regiona_med_001/,
  );
});

test('runDatacoreScrape writes DataCore mining param CSV after building the record graph', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-params-'));

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
    buildRecordGraph: async () => ({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    extractCommodities: async () => [],
    extractMiningElements: async () => [],
    extractMiningCompositions: async () => [],
    extractMineableEntities: async () => [],
    extractMiningClustering: async () => [],
    extractMiningHarvestablePresets: async () => [],
    extractMiningHarvestableSetups: async () => [],
    extractMiningParams: async () => [
      miningParamRow({
        ref: 'aa727a56-9937-4eb5-80c6-51b418d43177',
        path: 'libs/foundry/records/mining/miningglobalparamsship.xml',
        paramType: 'MiningGlobalParams',
        paramClass: 'MiningGlobalParamsShip',
        powerCapacityPerMass: '10',
        decayPerMass: '0.2',
        optimalWindowSize: '0.1',
        mineablePowerLevelRtpc: 'Mineable_Rock_Power_Level',
        clusterDetectionRadius: '10',
      }),
    ],
    extractMiningProviderPresets: async () => [],
  });

  const csvPath = path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'mining-params.datacore.csv');
  const csv = await fs.readFile(csvPath, 'utf8');

  assert.equal(result.miningParamResult.rows, 1);
  assert.equal(result.miningParamResult.csvFile, 'mining-params.datacore.csv');
  assert.match(
    csv,
    /^Param Type,Param Class,Highlight Occluded Alpha,Highlight Outline Width,Highlight Distant Mineables Range,Show Child Rock Radar Icon,Scale Power Graph Min,No Progress Hint Time,No Progress Hint Power,Fracture Done Feedback Duration,Max Scan Raycast Distance,Highlight Color,Highlight Color Absorbable,Highlight Color Distant,Highlight Color Distant Scanned,Camera Shake Enabled,Camera Shake Time Period,Camera Shake Frequency Noise Factor,Camera Shake Translation Noise,Camera Shake Rotation Noise,Camera Shake Max Under Optimal Window,Camera Shake In Optimal Window,Camera Shake Min In Danger Window,Camera Shake Change Lerp Speed,Camera Shake Offset Position,Camera Shake Offset Angle,Block Throttle Change When Not Firing,Throttle Reset On Stop Fire,Throttle Change Per Action,Throttle Acc Period,Throttle Acc Factor,Throttle Hold Acc Factor,Throttle RTPC,Power Capacity Per Mass,Decay Per Mass,Optimal Window Size,Optimal Window Factor,Resistance Curve Factor,Optimal Window Thinness Curve Factor,Optimal Window Max Size,Controlled Breaking Fill Rate,Controlled Breaking Fill Rate Danger,Controlled Breaking Decay Rate,Danger Breaking Fill Rate,Danger Breaking Fill Rate Exponent,Danger Breaking Decay Rate,Absorbable Volume Threshold,Child Rock Invulnerability Time,CSCU Per Volume,Default Mass,Modifier Persistence Time,Child Rock Life Timer,Child Rock Zero G Damping,Terrain Factor Static Threshold,Show Explosion FX For Surplus Child,Child Rock Inactivity Lifetime,Gadget Detach Threshold,Gadget Destroy Threshold,Danger To Gadget Damage,Waste Resource Type,Instability Wave Period,Instability Wave Variance,Instability Curve Factor,Danger Pool Factor,Explosion Default Volume,Hit History Window,Standard Deviation Multiplier,Time Exponent,Min Deviation,Extraction Magnitude,Max Effect On Instability,Fracture Particle Effect,Explosion Particle Effect,Center Rock Destroy Particle Effect,Fully Extracted Rock Particle Effect,Mineable Power Increasing Fall Off,Mineable Power Level RTPC,Mineable Danger Breaking RTPC,Mineable Optimal Breaking RTPC,Mineable Mass RTPC,Mineable Crack Glow Strength RTPC,Mining Start Trigger,Mining Stop Trigger,Good Fractured Trigger,Bad Fractured Trigger,Extracted Trigger,Cluster Detection Radius,Cluster Upper Object Count DGS,Cluster Upper Object Count Persistence,Cluster Persistence Timeout,Reset Lifetime On Move,Entity Idle Bury Only,Record GUID,Record Path\r?\n/,
  );
  assert.match(csv, /MiningGlobalParams,MiningGlobalParamsShip,+10,0\.2,0\.1/);
});

test('runDatacoreScrape reports whether force extract will clear an existing cache', async () => {
  let clearExistingValue: boolean | undefined;

  await runDatacoreScrape({
    repoRoot: 'repo',
    dryRun: true,
    forceExtract: true,
    loadTypes: async () => [],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 7,
    extractXmlCache: async ({ clearExisting }) => {
      assert.equal(clearExisting, true);
      return { workDcbPath: 'cache/Game.dcb', monolithicXmlPath: 'cache/Game.xml', xmlFileCount: 123 };
    },
    onCacheExtractStart: (_dcbPath, _xmlCacheDir, clearExisting) => {
      clearExistingValue = clearExisting;
    },
  });

  assert.equal(clearExistingValue, true);
});

test('runDatacoreScrape reports unknown requested types before touching local game state', async () => {
  let resolvedLiveDir = false;

  await assert.rejects(
    () =>
      runDatacoreScrape({
        repoRoot: 'repo',
        types: ['unknown'],
        loadTypes: async () => [typeEntry],
        resolveLiveDir: () => {
          resolvedLiveDir = true;
          return 'C:/Games/StarCitizen/LIVE';
        },
      }),
    /Unknown item type: "unknown"/,
  );

  assert.equal(resolvedLiveDir, false);
});

function miningParamRow(overrides: Partial<DataCoreMiningParamRecord>): DataCoreMiningParamRecord {
  return {
    ref: '',
    path: '',
    paramType: '',
    paramClass: '',
    highlightOccludedAlpha: '',
    highlightOutlineWidth: '',
    highlightDistantMineablesRange: '',
    showChildRockRadarIcon: '',
    scalePowerGraphMin: '',
    noProgressHintTime: '',
    noProgressHintPower: '',
    fractureDoneFeedbackDuration: '',
    maxScanRaycastDistance: '',
    highlightColor: '',
    highlightColorAbsorbable: '',
    highlightColorDistant: '',
    highlightColorDistantScanned: '',
    cameraShakeEnabled: '',
    cameraShakeTimePeriod: '',
    cameraShakeFrequencyNoiseFactor: '',
    cameraShakeTranslationNoise: '',
    cameraShakeRotationNoise: '',
    cameraShakeMaxUnderOptimalWindow: '',
    cameraShakeInOptimalWindow: '',
    cameraShakeMinInDangerWindow: '',
    cameraShakeChangeLerpSpeed: '',
    cameraShakeOffsetPosition: '',
    cameraShakeOffsetAngle: '',
    blockThrottleChangeWhenNotFiring: '',
    throttleResetOnStopFire: '',
    throttleChangePerAction: '',
    throttleAccPeriod: '',
    throttleAccFactor: '',
    throttleHoldAccFactor: '',
    throttleRtpc: '',
    powerCapacityPerMass: '',
    decayPerMass: '',
    optimalWindowSize: '',
    optimalWindowFactor: '',
    resistanceCurveFactor: '',
    optimalWindowThinnessCurveFactor: '',
    optimalWindowMaxSize: '',
    controlledBreakingFillRate: '',
    controlledBreakingFillRateDanger: '',
    controlledBreakingDecayRate: '',
    dangerBreakingFillRate: '',
    dangerBreakingFillRateExponent: '',
    dangerBreakingDecayRate: '',
    absorbableVolumeThreshold: '',
    childRockInvulnerabilityTime: '',
    cSCUPerVolume: '',
    defaultMass: '',
    modifierPersistenceTime: '',
    childRockLifeTimer: '',
    childRockZeroGDamping: '',
    terrainFactorStaticThreshold: '',
    showExplosionFXForSurplusChild: '',
    childRockInactivityLifetime: '',
    gadgetDetachThreshold: '',
    gadgetDestroyThreshold: '',
    dangerToGadgetDamage: '',
    wasteResourceType: '',
    instabilityWavePeriod: '',
    instabilityWaveVariance: '',
    instabilityCurveFactor: '',
    dangerPoolFactor: '',
    explosionDefaultVolume: '',
    hitHistoryWindow: '',
    standardDeviationMultiplier: '',
    timeExponent: '',
    minDeviation: '',
    extractionMagnitude: '',
    maxEffectOnInstability: '',
    fractureParticleEffect: '',
    explosionParticleEffect: '',
    centerRockDestroyParticleEffect: '',
    fullyExtractedRockParticleEffect: '',
    mineablePowerIncreasingFallOff: '',
    mineablePowerLevelRtpc: '',
    mineableDangerBreakingRtpc: '',
    mineableOptimalBreakingRtpc: '',
    mineableMassRtpc: '',
    mineableCrackGlowStrengthRtpc: '',
    miningStartTrigger: '',
    miningStopTrigger: '',
    goodFracturedTrigger: '',
    badFracturedTrigger: '',
    extractedTrigger: '',
    clusterDetectionRadius: '',
    clusterUpperObjectCountDGS: '',
    clusterUpperObjectCountPersistence: '',
    clusterPersistenceTimeout: '',
    resetLifetimeOnMove: '',
    entityIdleBuryOnly: '',
    ...overrides,
  };
}

test('runDatacoreScrape extracts mining laser stats from real-shaped DataCore XML', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-lasers-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const laserDir = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'entities', 'scitem', 'ships', 'weapons');
  await fs.mkdir(laserDir, { recursive: true });

  // Real-shaped XML for the GRIN Arbor MH1 S1 mining laser.
  await fs.writeFile(
    path.join(laserDir, 'mining_laser_grin_arbor_s1.xml'),
    `
      <EntityClassDefinition.Mining_Laser_GRIN_Arbor_S1 __path="libs/foundry/records/entities/scitem/ships/weapons/mining_laser_grin_arbor_s1.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="WeaponMining" SubType="Gun" Size="1" Grade="1" Manufacturer="GRIN">
              <Localization Name="@item_Mining_MiningLaser_Greycat_Default_S1" ShortName="@LOC_EMPTY" Description="@item_Mining_MiningLaser_Greycat_Default_S1_Desc" />
            </AttachDef>
          </SAttachableComponentParams>
          <SHealthComponentParams Health="8000" />
          <SCItemWeaponComponentParams>
            <fireActions>
              <SWeaponActionFireBeamParams hitType="ElectricArc" fullDamageRange="60" zeroDamageRange="180">
                <damagePerSecond>
                  <DamageInfo DamageEnergy="1890" />
                </damagePerSecond>
              </SWeaponActionFireBeamParams>
              <SWeaponActionFireBeamParams hitType="Extraction" fullDamageRange="60" zeroDamageRange="180">
                <damagePerSecond>
                  <DamageInfo DamageEnergy="1850" />
                </damagePerSecond>
              </SWeaponActionFireBeamParams>
            </fireActions>
          </SCItemWeaponComponentParams>
          <SEntityComponentMiningLaserParams throttleLerpSpeed="6.5" throttleMinimum="0.05">
            <miningLaserModifiers>
              <laserInstability>
                <FloatModifierMultiplicative value="-35" />
              </laserInstability>
              <optimalChargeWindowSizeModifier>
                <FloatModifierMultiplicative value="40" />
              </optimalChargeWindowSizeModifier>
              <resistanceModifier>
                <FloatModifierMultiplicative value="25" />
              </resistanceModifier>
            </miningLaserModifiers>
            <filterParams>
              <filterModifier>
                <FloatModifierMultiplicative value="30" />
              </filterModifier>
            </filterParams>
          </SEntityComponentMiningLaserParams>
        </Components>
      </EntityClassDefinition.Mining_Laser_GRIN_Arbor_S1>
    `,
  );

  // Real-shaped XML for the Hofstede S1 — has optimalChargeWindowRateModifier.
  await fs.writeFile(
    path.join(laserDir, 'mining_laser_shin_hofstede_s1.xml'),
    `
      <EntityClassDefinition.Mining_Laser_SHIN_Hofstede_S1 __path="libs/foundry/records/entities/scitem/ships/weapons/mining_laser_shin_hofstede_s1.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="WeaponMining" Size="1" Grade="1" Manufacturer="SHIN">
              <Localization Name="@item_Mining_MiningLaser_Shubin_1_S1" Description="@item_Mining_MiningLaser_Shubin_1_S1_Desc" />
            </AttachDef>
          </SAttachableComponentParams>
          <SHealthComponentParams Health="8000" />
          <SCItemWeaponComponentParams>
            <fireActions>
              <SWeaponActionFireBeamParams hitType="ElectricArc" fullDamageRange="45" zeroDamageRange="135">
                <damagePerSecond>
                  <DamageInfo DamageEnergy="2100" />
                </damagePerSecond>
              </SWeaponActionFireBeamParams>
            </fireActions>
          </SCItemWeaponComponentParams>
          <SEntityComponentMiningLaserParams throttleMinimum="0.05">
            <miningLaserModifiers>
              <laserInstability>
                <FloatModifierMultiplicative value="10" />
              </laserInstability>
              <optimalChargeWindowSizeModifier>
                <FloatModifierMultiplicative value="60" />
              </optimalChargeWindowSizeModifier>
              <resistanceModifier>
                <FloatModifierMultiplicative value="-30" />
              </resistanceModifier>
              <optimalChargeWindowRateModifier>
                <FloatModifierMultiplicative value="20" />
              </optimalChargeWindowRateModifier>
            </miningLaserModifiers>
            <filterParams>
              <filterModifier>
                <FloatModifierMultiplicative value="30" />
              </filterModifier>
            </filterParams>
          </SEntityComponentMiningLaserParams>
        </Components>
      </EntityClassDefinition.Mining_Laser_SHIN_Hofstede_S1>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'mining-lasers',
        csvFile: 'weaponmining.datacore.csv',
        typeConfig: MINING_LASER_TYPE_CONFIG,
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 2,
  });

  const csv = await fs.readFile(
    path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'weaponmining.datacore.csv'),
    'utf8',
  );

  assert.deepEqual(result.results, [
    { type: 'mining-lasers', rows: 2, skipped: 0, csvFile: 'weaponmining.datacore.csv' },
  ]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Power Max,Range Max,Range Min,Throttle Min,Power Min,Instability Modifier,Resistance Modifier,Optimal Charge Zone,Optimal Rate,Inert Materials\r?\n/,
  );
  // Arbor S1: Power Min = 1890 × 0.05 = 94.5
  assert.match(
    csv,
    /mining_laser_grin_arbor_s1,item_Mining_MiningLaser_Greycat_Default_S1,,item_Mining_MiningLaser_Greycat_Default_S1_Desc,GRIN,1,1,Gun,8000,1890,60,180,0\.05,94\.5,-35,25,40,,30/,
  );
  // Hofstede S1: has optimal rate modifier (+20), Power Min = 2100 × 0.05 = 105
  assert.match(
    csv,
    /mining_laser_shin_hofstede_s1,item_Mining_MiningLaser_Shubin_1_S1,,item_Mining_MiningLaser_Shubin_1_S1_Desc,SHIN,1,1,,8000,2100,45,135,0\.05,105,10,-30,60,20,30/,
  );
});

test('runDatacoreScrape extracts mining modifier stats from real-shaped DataCore XML', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-mining-modifiers-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const miningArmDir = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'ships',
    'utility',
    'mining',
    'miningarm',
  );
  await fs.mkdir(miningArmDir, { recursive: true });

  // Real-shaped XML for the Brandt active consumable mining module.
  // activationMethod="ActivateOnDemand", charges=5, duration=60s in ItemMiningModifierParams.
  // Power Mining: damageMultiplier=1.35 on fireActionIndex=0.
  // Rock modifiers: resistanceModifier=+15.5, shatterdamageModifier=-30.
  await fs.writeFile(
    path.join(miningArmDir, 'mining_modules_active_brandt.xml'),
    `
      <EntityClassDefinition.Mining_Modules_Active_Brandt __path="libs/foundry/records/entities/scitem/ships/utility/mining/miningarm/mining_modules_active_brandt.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="MiningModifier" SubType="Gun" Size="1" Grade="1" Manufacturer="MISC">
              <Localization Name="@item_Mining_Consumable_Brandt" ShortName="@LOC_EMPTY" Description="@item_Mining_Consumable_Brandt_Desc" />
            </AttachDef>
          </SAttachableComponentParams>
          <SHealthComponentParams Health="200" />
          <EntityComponentAttachableModifierParams activationMethod="ActivateOnDemand" charges="5">
            <modifiers>
              <ItemWeaponModifiersParams fireActionIndex="0" showInUI="1">
                <modifierLifetime>
                  <ItemModifierTimedLife lifetime="60" />
                </modifierLifetime>
                <weaponModifier>
                  <weaponStats damageMultiplier="1.35" />
                </weaponModifier>
              </ItemWeaponModifiersParams>
              <ItemWeaponModifiersParams fireActionIndex="1" showInUI="0">
                <weaponModifier>
                  <weaponStats damageMultiplier="1" />
                </weaponModifier>
              </ItemWeaponModifiersParams>
              <ItemMiningModifierParams>
                <modifierLifetime>
                  <ItemModifierTimedLife lifetime="60" />
                </modifierLifetime>
                <MiningLaserModifier isOptimalRateGood="1">
                  <resistanceModifier>
                    <FloatModifierMultiplicative showInUI="1" value="15.5" />
                  </resistanceModifier>
                  <shatterdamageModifier>
                    <FloatModifierMultiplicative showInUI="1" value="-30" />
                  </shatterdamageModifier>
                </MiningLaserModifier>
              </ItemMiningModifierParams>
            </modifiers>
          </EntityComponentAttachableModifierParams>
        </Components>
      </EntityClassDefinition.Mining_Modules_Active_Brandt>
    `,
  );

  // Real-shaped XML for the Focus Mk1 passive module.
  // activationMethod="ActivateOnAttach", charges=1 (permanent).
  // Power Mining: damageMultiplier=0.85 on fireActionIndex=0 (-15%).
  // Rock modifiers: optimalChargeWindowSizeModifier=+30.
  await fs.writeFile(
    path.join(miningArmDir, 'mining_modules_passive_focus_mk1.xml'),
    `
      <EntityClassDefinition.Mining_Modules_Passive_Focus_MK1 __path="libs/foundry/records/entities/scitem/ships/utility/mining/miningarm/mining_modules_passive_focus_mk1.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="MiningModifier" SubType="Gun" Size="1" Grade="1" Manufacturer="THCN">
              <Localization Name="@item_Mining_Modules_Passive_Focus_MK1" ShortName="@LOC_EMPTY" Description="@item_Mining_Modules_Passive_Focus_MK1_Desc" />
            </AttachDef>
          </SAttachableComponentParams>
          <SHealthComponentParams Health="200" />
          <EntityComponentAttachableModifierParams activationMethod="ActivateOnAttach" charges="1">
            <modifiers>
              <ItemWeaponModifiersParams fireActionIndex="0" showInUI="1">
                <weaponModifier>
                  <weaponStats damageMultiplier="0.85" />
                </weaponModifier>
              </ItemWeaponModifiersParams>
              <ItemWeaponModifiersParams fireActionIndex="1" showInUI="0">
                <weaponModifier>
                  <weaponStats damageMultiplier="1" />
                </weaponModifier>
              </ItemWeaponModifiersParams>
              <ItemMiningModifierParams>
                <MiningLaserModifier isOptimalRateGood="1">
                  <optimalChargeWindowSizeModifier>
                    <FloatModifierMultiplicative showInUI="1" value="30" />
                  </optimalChargeWindowSizeModifier>
                </MiningLaserModifier>
              </ItemMiningModifierParams>
            </modifiers>
          </EntityComponentAttachableModifierParams>
        </Components>
      </EntityClassDefinition.Mining_Modules_Passive_Focus_MK1>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'mining-modifiers',
        csvFile: 'miningmodifier.datacore.csv',
        typeConfig: MINING_MODIFIER_TYPE_CONFIG,
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 2,
  });

  const csv = await fs.readFile(
    path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'miningmodifier.datacore.csv'),
    'utf8',
  );

  assert.deepEqual(result.results, [
    { type: 'mining-modifiers', rows: 2, skipped: 0, csvFile: 'miningmodifier.datacore.csv' },
  ]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Type,Charges,Duration,Power Modifier Mining,Power Modifier Extract,Resistance,Instability,Optimal Charge Zone,Optimal Rate,Shatter Damage,Cluster Factor,Overcharge Rate,Inert Materials\r?\n/,
  );
  // Brandt: charges=5, duration=60, power mining=1.35, resistance=15.5, shatter=-30
  assert.match(
    csv,
    /mining_modules_active_brandt,item_Mining_Consumable_Brandt,,item_Mining_Consumable_Brandt_Desc,MISC,1,1,Gun,200,Module,5,60,1\.35,1,15\.5,,,,-30,,,/,
  );
  // Focus Mk1: charges=1 (passive), power mining=0.85, optimal charge zone=30
  assert.match(
    csv,
    /mining_modules_passive_focus_mk1,item_Mining_Modules_Passive_Focus_MK1,,item_Mining_Modules_Passive_Focus_MK1_Desc,THCN,1,1,Gun,200,Module,1,,0\.85,1,,,30,,,,,/,
  );
});

test('runDatacoreScrape extracts salvage modifier stats from real-shaped DataCore XML', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-scrape-salvage-modifiers-'));
  const xmlCacheDir = path.join(repoRoot, 'csv', 'datacore', '.xmlcache', '4.8.1-live');
  const salvageDir = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'entities',
    'scitem',
    'ships',
    'utility',
    'salvage',
    'salvagemodifiers',
  );
  await fs.mkdir(salvageDir, { recursive: true });

  // Real-shaped XML for the Trawler scraper module (large).
  // salvageSpeedMultiplier=0.05, radiusMultiplier=6, extractionEfficiency=0.6
  await fs.writeFile(
    path.join(salvageDir, 'salvage_modifier_scraper_large.xml'),
    `
      <EntityClassDefinition.Salvage_Modifier_Scraper_Large __path="libs/foundry/records/entities/scitem/ships/utility/salvage/salvagemodifiers/salvage_modifier_scraper_large.xml">
        <Components>
          <SAttachableComponentParams>
            <AttachDef Type="SalvageModifier" Size="1" Grade="1" Manufacturer="GRIN">
              <Localization Name="@item_scraper_GRIN_Large_Name" ShortName="@LOC_PLACEHOLDER" Description="@item_scraper_GRIN_Large_Desc" />
            </AttachDef>
          </SAttachableComponentParams>
          <SHealthComponentParams Health="100" />
          <EntityComponentAttachableModifierParams activationMethod="ActivateOnDemand" charges="0">
            <modifiers>
              <ItemWeaponModifiersParams fireActionIndex="0" setFireActionOnEnable="1" showInUI="0">
                <weaponModifier>
                  <weaponStats damageMultiplier="1">
                    <salvageModifier salvageSpeedMultiplier="0.05" radiusMultiplier="6" extractionEfficiency="0.6" />
                  </weaponStats>
                </weaponModifier>
              </ItemWeaponModifiersParams>
            </modifiers>
          </EntityComponentAttachableModifierParams>
        </Components>
      </EntityClassDefinition.Salvage_Modifier_Scraper_Large>
    `,
  );

  const result = await runDatacoreScrape({
    repoRoot,
    loadTypes: async () => [
      {
        name: 'salvage-modifiers',
        csvFile: 'salvagemodifier.datacore.csv',
        typeConfig: SALVAGE_MODIFIER_TYPE_CONFIG,
      },
    ],
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    readGameVersion: async () => '4.8.1',
    findDcbFile: async () => 'C:/Games/StarCitizen/LIVE/Data/Game.dcb',
    ensureTools: async () => ({ unp4k: 'unp4k.exe', unforge: 'unforge.cli.exe' }),
    countXmlFiles: async () => 1,
  });

  const csv = await fs.readFile(
    path.join(repoRoot, 'csv', 'datacore', '4.8.1-live', 'salvagemodifier.datacore.csv'),
    'utf8',
  );

  assert.deepEqual(result.results, [
    { type: 'salvage-modifiers', rows: 1, skipped: 0, csvFile: 'salvagemodifier.datacore.csv' },
  ]);
  assert.match(
    csv,
    /^Entity Class,Name Key,Short Name Key,Description Key,Manufacturer,Size,Grade,Class,Health,Speed Multiplier,Radius Multiplier,Extraction Efficiency\r?\n/,
  );
  assert.match(
    csv,
    /salvage_modifier_scraper_large,item_scraper_GRIN_Large_Name,,item_scraper_GRIN_Large_Desc,GRIN,1,1,,100,0\.05,6,0\.6/,
  );
});

async function writeXml(xmlCacheDir: string, recordPath: string, xml: string): Promise<void> {
  const xmlPath = path.join(xmlCacheDir, recordPath);
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(xmlPath, xml, 'utf8');
}
