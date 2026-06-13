import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreMiningHarvestablePresets } from './mining-harvestable-preset-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

const asteroidPresetPath = 'libs/foundry/records/harvestable/harvestablepresets/mining_asteroidcommon_aluminum.xml';
const fpsPresetPath = 'libs/foundry/records/harvestable/harvestablepresets/fpsmining_aphorite.xml';
const lootPresetPath = 'libs/foundry/records/harvestable/harvestablepresets/weapons_cz.xml';
const asteroidEntityPath = 'libs/foundry/records/entities/mineable/asteroidctypemineablerock_aluminium.xml';
const fpsEntityPath = 'libs/foundry/records/entities/mineable/aphoritemineablerockfps_asteroid.xml';
const lootEntityPath = 'libs/foundry/records/entities/loot/weapons_cz.xml';

test('extractDataCoreMiningHarvestablePresets extracts mining preset links and respawn facts', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-mining-harvestable-presets-'));
  await writeXml(
    xmlCacheDir,
    asteroidPresetPath,
    `<HarvestablePreset.Mining_AsteroidCommon_Aluminum entityClass="stale-asteroid-entity-guid" respawnInSlotTime="3600" __type="HarvestablePreset" __ref="asteroid-preset-guid" __path="${asteroidPresetPath}" />`,
  );
  await writeXml(
    xmlCacheDir,
    fpsPresetPath,
    `<HarvestablePreset.FPSMining_Aphorite entityClass="stale-fps-entity-guid" respawnInSlotTime="1800" specialHarvestableString="Rare" __type="HarvestablePreset" __ref="fps-preset-guid" __path="${fpsPresetPath}" />`,
  );
  await writeXml(
    xmlCacheDir,
    lootPresetPath,
    `<HarvestablePreset.Weapons_CZ entityClass="stale-loot-entity-guid" respawnInSlotTime="7200" __type="HarvestablePreset" __ref="loot-preset-guid" __path="${lootPresetPath}" />`,
  );

  const rows = await extractDataCoreMiningHarvestablePresets({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph()),
  });

  assert.deepEqual(rows, [
    {
      ref: 'fps-preset-guid',
      path: fpsPresetPath,
      harvestablePresetClass: 'FPSMining_Aphorite',
      harvestableEntityGuid: 'fps-entity-guid',
      harvestableEntityClass: 'AphoriteMineableRockFPS_Asteroid',
      harvestableEntityPath: fpsEntityPath,
      respawnInSlotTime: '1800',
      specialHarvestableString: 'Rare',
    },
    {
      ref: 'asteroid-preset-guid',
      path: asteroidPresetPath,
      harvestablePresetClass: 'Mining_AsteroidCommon_Aluminum',
      harvestableEntityGuid: 'asteroid-entity-guid',
      harvestableEntityClass: 'AsteroidCTypeMineableRock_Aluminium',
      harvestableEntityPath: asteroidEntityPath,
      respawnInSlotTime: '3600',
      specialHarvestableString: '',
    },
  ]);
});

async function writeXml(xmlCacheDir: string, recordPath: string, xml: string): Promise<void> {
  const xmlPath = path.join(xmlCacheDir, recordPath);
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(xmlPath, xml, 'utf8');
}

function makeGraph(): DataCoreRecordGraph {
  const records = [
    node(
      asteroidPresetPath,
      'asteroid-preset-guid',
      'HarvestablePreset.Mining_AsteroidCommon_Aluminum',
      'HarvestablePreset',
      'Mining_AsteroidCommon_Aluminum',
      [
        { attribute: 'entityClass', value: '' },
        { attribute: 'entityClass', value: 'asteroid-entity-guid' },
      ],
    ),
    node(
      fpsPresetPath,
      'fps-preset-guid',
      'HarvestablePreset.FPSMining_Aphorite',
      'HarvestablePreset',
      'FPSMining_Aphorite',
      [
        { attribute: 'entityClass', value: '' },
        { attribute: 'entityClass', value: 'fps-entity-guid' },
      ],
    ),
    node(lootPresetPath, 'loot-preset-guid', 'HarvestablePreset.Weapons_CZ', 'HarvestablePreset', 'Weapons_CZ', [
      { attribute: 'entityClass', value: '' },
      { attribute: 'entityClass', value: 'loot-entity-guid' },
    ]),
    node(
      asteroidEntityPath,
      'asteroid-entity-guid',
      'EntityClassDefinition.AsteroidCTypeMineableRock_Aluminium',
      'EntityClassDefinition',
      'AsteroidCTypeMineableRock_Aluminium',
    ),
    node(
      fpsEntityPath,
      'fps-entity-guid',
      'EntityClassDefinition.AphoriteMineableRockFPS_Asteroid',
      'EntityClassDefinition',
      'AphoriteMineableRockFPS_Asteroid',
    ),
    node(lootEntityPath, 'loot-entity-guid', 'EntityClassDefinition.Weapons_CZ', 'EntityClassDefinition', 'Weapons_CZ'),
  ];

  return {
    source: 'datacore-record-graph',
    recordCount: records.length,
    records,
    indexes: {
      byRef: Object.fromEntries(records.map((record) => [record.ref, record.path])),
      byPath: Object.fromEntries(records.map((record, index) => [record.path, index])),
      byRootType: {
        HarvestablePreset: [asteroidPresetPath, fpsPresetPath, lootPresetPath],
        EntityClassDefinition: [asteroidEntityPath, fpsEntityPath, lootEntityPath],
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
  referencedGuidAttributes: NonNullable<DataCoreRecordGraph['records'][number]['referencedGuidAttributes']> = [],
) {
  return {
    path,
    ref,
    rootTag,
    rootType,
    entityClass,
    localizationKeys: [],
    referencedGuids: referencedGuidAttributes.map((reference) => reference.value),
    referencedGuidAttributes,
  };
}
