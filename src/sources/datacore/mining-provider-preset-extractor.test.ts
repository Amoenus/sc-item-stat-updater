import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreMiningProviderPresets } from './mining-provider-preset-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

const providerPath = 'libs/foundry/records/harvestable/providerpresets/system/stanton/hpp_stanton1.xml';
const harvestablePresetPath = 'libs/foundry/records/harvestable/harvestablepresets/mining_asteroidcommon_aluminum.xml';
const harvestablePath = 'libs/foundry/records/entities/mineable/agriciumrock.xml';
const setupPath = 'libs/foundry/records/harvestable/harvestablesetups/mineablerockharvestablesetup.xml';
const clusteringPath = 'libs/foundry/records/harvestable/clusteringpresets/asteroid_lrg_med_sml.xml';
const compositionPath = 'libs/foundry/records/mining/rockcompositionpresets/asteroid_ctype_aluminium.xml';

test('extractDataCoreMiningProviderPresets extracts mining provider rows and resolves refs', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-mining-provider-presets-'));
  await writeXml(
    xmlCacheDir,
    providerPath,
    `
      <HarvestableProviderPreset.HPP_Stanton1 __type="HarvestableProviderPreset" __ref="449763d3-5ba2-4a97-873d-cedf802b9aea" __path="${providerPath}">
        <harvestableGroups>
          <HarvestableElementGroup groupName="SpaceShip_Mineables" groupProbability="6">
            <harvestables>
              <HarvestableElement harvestable="e576319a-80bf-46a6-b600-ab4d5e34c00f" relativeProbability="44" clustering="70128b72-7c50-4315-bed8-59a1c2ef7996">
                <geometries>
                  <HarvestableGeometry tag="6874072c-c021-43bc-b8d9-d06b810102c5" />
                </geometries>
              </HarvestableElement>
              <HarvestableElement harvestableEntityClass="dfa89ac4-393b-4e8d-97b4-5ce21ee61970" harvestableSetup="0aa9921e-8de0-487e-bc87-1d457c56d74f" relativeProbability="1" />
            </harvestables>
          </HarvestableElementGroup>
          <HarvestableElementGroup groupName="Salvage_FreshDerelicts" groupProbability="0.04">
            <harvestables>
              <HarvestableElement harvestable="salvage-guid" relativeProbability="900" />
            </harvestables>
          </HarvestableElementGroup>
        </harvestableGroups>
      </HarvestableProviderPreset.HPP_Stanton1>
    `,
  );
  await writeXml(
    xmlCacheDir,
    harvestablePresetPath,
    `
      <HarvestablePreset.Mining_AsteroidCommon_Aluminum entityClass="1c949ce0-c99b-485b-b783-2ea3b49162c0" respawnInSlotTime="3600" __type="HarvestablePreset" __ref="e576319a-80bf-46a6-b600-ab4d5e34c00f" __path="${harvestablePresetPath}" />
    `,
  );
  await writeXml(
    xmlCacheDir,
    harvestablePath,
    `
      <EntityClassDefinition.AgriciumRock __type="EntityClassDefinition" __ref="1c949ce0-c99b-485b-b783-2ea3b49162c0" __path="${harvestablePath}">
        <MineableParams globalParams="aa727a56-9937-4eb5-80c6-51b418d43177" audioParams="5f5c1a61-6500-46a1-8a01-7ba4956751d1" composition="3a6e7bb4-0f23-4c46-b822-333afe9d63ab" filledFactor="1" />
      </EntityClassDefinition.AgriciumRock>
    `,
  );

  const rows = await extractDataCoreMiningProviderPresets({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph()),
  });

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    ref: '449763d3-5ba2-4a97-873d-cedf802b9aea',
    path: providerPath,
    providerClass: 'HPP_Stanton1',
    system: 'stanton',
    location: 'hpp_stanton1',
    groupName: 'SpaceShip_Mineables',
    groupProbability: '6',
    entryIndex: '0.0',
    harvestableGuid: 'e576319a-80bf-46a6-b600-ab4d5e34c00f',
    harvestableClass: 'Mining_AsteroidCommon_Aluminum',
    harvestablePath: harvestablePresetPath,
    harvestableEntityGuid: '1c949ce0-c99b-485b-b783-2ea3b49162c0',
    harvestableEntityClass: 'AgriciumRock',
    harvestableEntityPath: harvestablePath,
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
  });
  assert.equal(rows[1].harvestableSetupGuid, '0aa9921e-8de0-487e-bc87-1d457c56d74f');
  assert.equal(rows[1].harvestableSetupClass, 'MineableRockHarvestableSetup');
  assert.equal(rows[1].harvestableEntityGuid, 'dfa89ac4-393b-4e8d-97b4-5ce21ee61970');
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
      {
        path: providerPath,
        ref: '449763d3-5ba2-4a97-873d-cedf802b9aea',
        rootTag: 'HarvestableProviderPreset.HPP_Stanton1',
        rootType: 'HarvestableProviderPreset',
        entityClass: 'HPP_Stanton1',
        localizationKeys: [],
        referencedGuids: [],
      },
      {
        path: harvestablePresetPath,
        ref: 'e576319a-80bf-46a6-b600-ab4d5e34c00f',
        rootTag: 'HarvestablePreset.Mining_AsteroidCommon_Aluminum',
        rootType: 'HarvestablePreset',
        entityClass: 'Mining_AsteroidCommon_Aluminum',
        localizationKeys: [],
        referencedGuids: [],
      },
      {
        path: harvestablePath,
        ref: '1c949ce0-c99b-485b-b783-2ea3b49162c0',
        rootTag: 'EntityClassDefinition.AgriciumRock',
        rootType: 'EntityClassDefinition',
        entityClass: 'AgriciumRock',
        localizationKeys: [],
        referencedGuids: [],
      },
      {
        path: setupPath,
        ref: '0aa9921e-8de0-487e-bc87-1d457c56d74f',
        rootTag: 'HarvestableSetup.MineableRockHarvestableSetup',
        rootType: 'HarvestableSetup',
        entityClass: 'MineableRockHarvestableSetup',
        localizationKeys: [],
        referencedGuids: [],
      },
      {
        path: clusteringPath,
        ref: '70128b72-7c50-4315-bed8-59a1c2ef7996',
        rootTag: 'HarvestableClusterPreset.Asteroid_Lrg_Med_Sml',
        rootType: 'HarvestableClusterPreset',
        entityClass: 'Asteroid_Lrg_Med_Sml',
        localizationKeys: [],
        referencedGuids: [],
      },
      {
        path: compositionPath,
        ref: '3a6e7bb4-0f23-4c46-b822-333afe9d63ab',
        rootTag: 'MineableComposition.Asteroid_CType_Aluminium',
        rootType: 'MineableComposition',
        entityClass: 'Asteroid_CType_Aluminium',
        localizationKeys: [],
        referencedGuids: [],
      },
    ],
    indexes: {
      byRef: {
        '449763d3-5ba2-4a97-873d-cedf802b9aea': providerPath,
        'e576319a-80bf-46a6-b600-ab4d5e34c00f': harvestablePresetPath,
        '1c949ce0-c99b-485b-b783-2ea3b49162c0': harvestablePath,
        '0aa9921e-8de0-487e-bc87-1d457c56d74f': setupPath,
        '70128b72-7c50-4315-bed8-59a1c2ef7996': clusteringPath,
        '3a6e7bb4-0f23-4c46-b822-333afe9d63ab': compositionPath,
      },
      byPath: {
        [providerPath]: 0,
        [harvestablePresetPath]: 1,
        [harvestablePath]: 2,
        [setupPath]: 3,
        [clusteringPath]: 4,
        [compositionPath]: 5,
      },
      byRootType: {
        HarvestableProviderPreset: [providerPath],
      },
      byEntityClass: {},
      byLocalizationKey: {},
      byReferencedGuid: {},
    },
  };
}
