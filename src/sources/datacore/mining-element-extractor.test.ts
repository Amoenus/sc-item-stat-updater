import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreMiningElements } from './mining-element-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

const agriciumPath = 'libs/foundry/records/mining/mineableelements/agricium_ore.xml';
const aslaritePath = 'libs/foundry/records/mining/mineableelements/aslarite_raw.xml';
const aphoritePath = 'libs/foundry/records/mining/mineableelements/minableelement_fps_aphorite.xml';
const globalParamsPath = 'libs/foundry/records/mining/miningglobalparams.xml';
const agriciumResourcePath = 'libs/foundry/records/entities/commodities/agricium_ore.xml';
const aslariteResourcePath = 'libs/foundry/records/entities/commodities/aslarite_raw.xml';
const agriciumResourceGuid = 'fc1ec740-3047-48d8-81f0-396f4c9a90ef';
const aslariteResourceGuid = 'f0c1f30b-001c-4a80-ac20-27df27183056';

test('extractDataCoreMiningElements extracts first-party mineable element behavior facts', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-mining-elements-'));
  await writeXml(
    xmlCacheDir,
    agriciumPath,
    `<MineableElement.Agricium_Ore resourceType="stale-resource-guid" elementInstability="350" elementResistance="0.5" elementOptimalWindowMidpoint="0.5" elementOptimalWindowMidpointRandomness="0.15" elementOptimalWindowThinness="2" elementExplosionMultiplier="4" elementClusterFactor="0.2" __type="MineableElement" __ref="d61d6c33-e428-4014-9326-0b06034de16a" __path="${agriciumPath}" />`,
  );
  await writeXml(
    xmlCacheDir,
    aslaritePath,
    `<MineableElement.Aslarite_Raw resourceType="stale-aslarite-resource-guid" elementInstability="700" elementResistance="0.5" elementOptimalWindowMidpoint="0.4" elementOptimalWindowMidpointRandomness="0.2" elementOptimalWindowThinness="0.6" elementExplosionMultiplier="240" elementClusterFactor="0.1" __type="MineableElement" __ref="9bd0e34c-2b34-42a3-b41d-381088ff6fed" __path="${aslaritePath}" />`,
  );
  await writeXml(
    xmlCacheDir,
    aphoritePath,
    `<MineableElement.MinableElement_FPS_Aphorite resourceType="9b47bacf-8efa-42e2-8d84-dee64983a00a" elementInstability="0" elementResistance="0" elementOptimalWindowMidpoint="0.7" elementOptimalWindowMidpointRandomness="0" elementOptimalWindowThinness="0" elementExplosionMultiplier="0" elementClusterFactor="0" __type="MineableElement" __ref="2ee59447-83e0-4f26-899e-df66780008e3" __path="${aphoritePath}" />`,
  );

  const rows = await extractDataCoreMiningElements({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph()),
  });

  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((row) => row.path),
    [agriciumPath, aslaritePath, aphoritePath],
  );

  const agricium = rows.find((row) => row.elementClass === 'Agricium_Ore');
  assert.ok(agricium);
  assert.equal(agricium.elementName, 'Agricium (Ore)');
  assert.equal(agricium.materialName, 'Agricium');
  assert.equal(agricium.inferredDescriptionKey, 'items_commodities_agricium_ore_graph_desc');
  assert.equal(agricium.resourceTypeGuid, agriciumResourceGuid);
  assert.equal(agricium.instability, '350');
  assert.equal(agricium.resistance, '0.5');
  assert.equal(agricium.optimalWindowMidpoint, '0.5');
  assert.equal(agricium.optimalWindowRandomness, '0.15');
  assert.equal(agricium.optimalWindowThinness, '2');
  assert.equal(agricium.explosionMultiplier, '4');
  assert.equal(agricium.clusterFactor, '0.2');

  const aslarite = rows.find((row) => row.elementClass === 'Aslarite_Raw');
  assert.ok(aslarite);
  assert.equal(aslarite.elementName, 'Aslarite (Raw)');
  assert.equal(aslarite.materialName, 'Aslarite');
  assert.equal(aslarite.inferredDescriptionKey, 'items_commodities_aslarite_raw_desc');
  assert.equal(aslarite.resourceTypeGuid, 'stale-aslarite-resource-guid');

  const aphorite = rows.find((row) => row.elementClass === 'MinableElement_FPS_Aphorite');
  assert.ok(aphorite);
  assert.equal(aphorite.elementName, 'Aphorite');
  assert.equal(aphorite.materialName, 'Aphorite');
  assert.equal(aphorite.inferredDescriptionKey, '');
});

test('extractDataCoreMiningElements normalizes Aluminium material name to American spelling', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-mining-aluminium-'));
  const aluminiumPath = 'libs/foundry/records/mining/mineableelements/aluminium_ore.xml';
  await writeXml(
    xmlCacheDir,
    aluminiumPath,
    `<MineableElement.Aluminium_Ore resourceType="e30bdd32-8fd5-44b8-9994-5fd253a16c37" __type="MineableElement" __ref="3776294d-5689-41f2-b03d-e8fcd17ede6a" __path="${aluminiumPath}" />`,
  );

  const rows = await extractDataCoreMiningElements({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [
        node(
          aluminiumPath,
          '3776294d-5689-41f2-b03d-e8fcd17ede6a',
          'MineableElement.Aluminium_Ore',
          'MineableElement',
          'Aluminium_Ore',
        ),
      ],
      indexes: {
        byRef: {},
        byPath: { [aluminiumPath]: 0 },
        byRootType: { MineableElement: [aluminiumPath] },
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
  });

  assert.equal(rows[0].elementName, 'Aluminium (Ore)');
  assert.equal(rows[0].materialName, 'Aluminum');
  assert.equal(rows[0].inferredDescriptionKey, 'items_commodities_aluminum_ore_desc');
});

test('extractDataCoreMiningElements normalizes Sileron mineable element to Stileron', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-mining-sileron-'));
  const sileronPath = 'libs/foundry/records/mining/mineableelements/sileron_ore.xml';
  await writeXml(
    xmlCacheDir,
    sileronPath,
    `<MineableElement.Sileron_Ore resourceType="32bafbd4-c52a-476d-b31c-97c4b3102471" __type="MineableElement" __ref="9498a080-84c0-41f4-b88f-71942c60c43f" __path="${sileronPath}" />`,
  );

  const rows = await extractDataCoreMiningElements({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [
        node(
          sileronPath,
          '9498a080-84c0-41f4-b88f-71942c60c43f',
          'MineableElement.Sileron_Ore',
          'MineableElement',
          'Sileron_Ore',
        ),
      ],
      indexes: {
        byRef: {},
        byPath: { [sileronPath]: 0 },
        byRootType: { MineableElement: [sileronPath] },
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
  });

  assert.equal(rows[0].elementClass, 'Sileron_Ore');
  assert.equal(rows[0].elementName, 'Stileron (Ore)');
  assert.equal(rows[0].materialName, 'Stileron');
  assert.equal(rows[0].inferredDescriptionKey, 'items_commodities_stileron_ore_desc');
});

async function writeXml(xmlCacheDir: string, recordPath: string, xml: string): Promise<void> {
  const xmlPath = path.join(xmlCacheDir, recordPath);
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(xmlPath, xml, 'utf8');
}

function makeGraph(): DataCoreRecordGraph {
  return {
    source: 'datacore-record-graph',
    recordCount: 6,
    records: [
      node(
        agriciumPath,
        'd61d6c33-e428-4014-9326-0b06034de16a',
        'MineableElement.Agricium_Ore',
        'MineableElement',
        'Agricium_Ore',
        [],
        [
          { attribute: 'resourceType', value: '' },
          { attribute: 'resourceType', value: agriciumResourceGuid },
        ],
      ),
      node(
        aslaritePath,
        '9bd0e34c-2b34-42a3-b41d-381088ff6fed',
        'MineableElement.Aslarite_Raw',
        'MineableElement',
        'Aslarite_Raw',
        [],
        [
          { attribute: 'resourceType', value: '' },
          { attribute: 'resourceType', value: aslariteResourceGuid },
          { attribute: 'resourceType', value: '7afcd406-f76b-4dd7-8700-25a74a12ecbd' },
        ],
      ),
      node(
        aphoritePath,
        '2ee59447-83e0-4f26-899e-df66780008e3',
        'MineableElement.MinableElement_FPS_Aphorite',
        'MineableElement',
        'MinableElement_FPS_Aphorite',
      ),
      node(
        globalParamsPath,
        '11111111-1111-1111-1111-111111111111',
        'MiningGlobalParams.MiningGlobalParams',
        'MiningGlobalParams',
        'MiningGlobalParams',
      ),
      node(
        agriciumResourcePath,
        agriciumResourceGuid,
        'Commodity.Agricium_Ore',
        'Commodity',
        'Agricium_Ore',
        [{ attribute: 'Description', key: 'items_commodities_agricium_ore_graph_desc' }],
      ),
      node(
        aslariteResourcePath,
        aslariteResourceGuid,
        'Commodity.Aslarite_Raw',
        'Commodity',
        'Aslarite_Raw',
        [{ attribute: 'Description', key: 'LOC_UNINITIALIZED' }],
      ),
    ],
    indexes: {
      byRef: { [agriciumResourceGuid]: agriciumResourcePath, [aslariteResourceGuid]: aslariteResourcePath },
      byPath: {
        [agriciumPath]: 0,
        [aslaritePath]: 1,
        [aphoritePath]: 2,
        [globalParamsPath]: 3,
        [agriciumResourcePath]: 4,
        [aslariteResourcePath]: 5,
      },
      byRootType: {
        MineableElement: [agriciumPath, aslaritePath, aphoritePath],
        MiningGlobalParams: [globalParamsPath],
        Commodity: [agriciumResourcePath, aslariteResourcePath],
      },
      byEntityClass: {},
      byLocalizationKey: {},
      byReferencedGuid: {},
    },
  };
}

function node(
  path: string,
  ref: string,
  rootTag: string,
  rootType: string,
  entityClass: string,
  localizationKeys: DataCoreRecordGraph['records'][number]['localizationKeys'] = [],
  referencedGuidAttributes: NonNullable<DataCoreRecordGraph['records'][number]['referencedGuidAttributes']> = [],
) {
  return {
    path,
    ref,
    rootTag,
    rootType,
    entityClass,
    localizationKeys,
    referencedGuids: referencedGuidAttributes.map((reference) => reference.value),
    referencedGuidAttributes,
  };
}
