import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import { extractDataCoreMiningElements } from './mining-element-extractor';
import type { DataCoreRecordGraph } from './types';

const agriciumPath = 'libs/foundry/records/mining/mineableelements/agricium_ore.xml';
const aslaritePath = 'libs/foundry/records/mining/mineableelements/aslarite_raw.xml';
const aphoritePath = 'libs/foundry/records/mining/mineableelements/minableelement_fps_aphorite.xml';
const globalParamsPath = 'libs/foundry/records/mining/miningglobalparams.xml';

test('extractDataCoreMiningElements extracts first-party mineable element behavior facts', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-mining-elements-'));
  await writeXml(
    xmlCacheDir,
    agriciumPath,
    `<MineableElement.Agricium_Ore resourceType="fc1ec740-3047-48d8-81f0-396f4c9a90ef" elementInstability="350" elementResistance="0.5" elementOptimalWindowMidpoint="0.5" elementOptimalWindowMidpointRandomness="0.15" elementOptimalWindowThinness="2" elementExplosionMultiplier="4" elementClusterFactor="0.2" __type="MineableElement" __ref="d61d6c33-e428-4014-9326-0b06034de16a" __path="${agriciumPath}" />`,
  );
  await writeXml(
    xmlCacheDir,
    aslaritePath,
    `<MineableElement.Aslarite_Raw resourceType="f0c1f30b-001c-4a80-ac20-27df27183056" elementInstability="700" elementResistance="0.5" elementOptimalWindowMidpoint="0.4" elementOptimalWindowMidpointRandomness="0.2" elementOptimalWindowThinness="0.6" elementExplosionMultiplier="240" elementClusterFactor="0.1" __type="MineableElement" __ref="9bd0e34c-2b34-42a3-b41d-381088ff6fed" __path="${aslaritePath}" />`,
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
  assert.equal(agricium.inferredDescriptionKey, 'items_commodities_agricium_ore_desc');
  assert.equal(agricium.resourceTypeGuid, 'fc1ec740-3047-48d8-81f0-396f4c9a90ef');
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
  assert.equal(aslarite.inferredDescriptionKey, 'items_commodities_aslarite_raw_desc');

  const aphorite = rows.find((row) => row.elementClass === 'MinableElement_FPS_Aphorite');
  assert.ok(aphorite);
  assert.equal(aphorite.elementName, 'Aphorite');
  assert.equal(aphorite.inferredDescriptionKey, '');
});

async function writeXml(xmlCacheDir: string, recordPath: string, xml: string): Promise<void> {
  const xmlPath = path.join(xmlCacheDir, recordPath);
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(xmlPath, xml, 'utf8');
}

function makeGraph(): DataCoreRecordGraph {
  return {
    source: 'datacore-record-graph',
    recordCount: 4,
    records: [
      node(agriciumPath, 'd61d6c33-e428-4014-9326-0b06034de16a', 'MineableElement.Agricium_Ore', 'MineableElement', 'Agricium_Ore'),
      node(aslaritePath, '9bd0e34c-2b34-42a3-b41d-381088ff6fed', 'MineableElement.Aslarite_Raw', 'MineableElement', 'Aslarite_Raw'),
      node(
        aphoritePath,
        '2ee59447-83e0-4f26-899e-df66780008e3',
        'MineableElement.MinableElement_FPS_Aphorite',
        'MineableElement',
        'MinableElement_FPS_Aphorite',
      ),
      node(globalParamsPath, '11111111-1111-1111-1111-111111111111', 'MiningGlobalParams.MiningGlobalParams', 'MiningGlobalParams', 'MiningGlobalParams'),
    ],
    indexes: {
      byRef: {},
      byPath: {
        [agriciumPath]: 0,
        [aslaritePath]: 1,
        [aphoritePath]: 2,
        [globalParamsPath]: 3,
      },
      byRootType: {
        MineableElement: [agriciumPath, aslaritePath, aphoritePath],
        MiningGlobalParams: [globalParamsPath],
      },
      byEntityClass: {},
      byLocalizationKey: {},
      byReferencedGuid: {},
    },
  };
}

function node(path: string, ref: string, rootTag: string, rootType: string, entityClass: string) {
  return {
    path,
    ref,
    rootTag,
    rootType,
    entityClass,
    localizationKeys: [],
    referencedGuids: [],
  };
}
