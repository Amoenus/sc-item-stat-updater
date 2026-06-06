import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreMiningHarvestableSetups } from './mining-harvestable-setup-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

const providerPath = 'libs/foundry/records/harvestable/providerpresets/system/stanton/hpp_stanton1.xml';
const defaultSetupPath = 'libs/foundry/records/harvestable/harvestablesetups/defaultharvestablesetup.xml';
const mineableSetupPath = 'libs/foundry/records/harvestable/harvestablesetups/mineablerockharvestablesetup.xml';
const lootSetupPath = 'libs/foundry/records/harvestable/harvestablesetups/lootcrateharvestablesetup.xml';
const harvestablePath = 'libs/foundry/records/entities/mineable/agriciumrock.xml';

test('extractDataCoreMiningHarvestableSetups extracts mining setup conditions and transform facts', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-mining-harvestable-setups-'));
  await writeXml(
    xmlCacheDir,
    providerPath,
    `
      <HarvestableProviderPreset.HPP_Stanton1 __type="HarvestableProviderPreset" __ref="provider-guid" __path="${providerPath}">
        <harvestableGroups>
          <HarvestableElementGroup groupName="SpaceShip_Mineables" groupProbability="6">
            <harvestables>
              <HarvestableElement harvestable="mineable-entity-guid" harvestableSetup="default-setup-guid" />
            </harvestables>
          </HarvestableElementGroup>
          <HarvestableElementGroup groupName="Loot_Crates" groupProbability="1">
            <harvestables>
              <HarvestableElement harvestable="loot-guid" harvestableSetup="loot-setup-guid" />
            </harvestables>
          </HarvestableElementGroup>
        </harvestableGroups>
      </HarvestableProviderPreset.HPP_Stanton1>
    `,
  );
  await writeXml(
    xmlCacheDir,
    defaultSetupPath,
    `
      <HarvestableSetup.DefaultHarvestableSetup respawnInSlotTime="120" specialHarvestableString="Rare" __type="HarvestableSetup" __ref="default-setup-guid" __path="${defaultSetupPath}">
        <harvestBehaviour>
          <harvestConditions>
            <HarvestConditionHealth healthRatio="0" />
            <HarvestConditionInteraction includeAttachedChildren="0" allInteractionsClearSpawnPoint="1" />
            <HarvestConditionMovement distance="5" />
          </harvestConditions>
          <despawnTimer despawnTimeSeconds="600" additionalWaitForNearbyPlayersSeconds="300" />
        </harvestBehaviour>
        <transformParams minScale="0.5" maxScale="1.5" terrainNormalAlignment="1" minZOffset="-2" maxZOffset="3" minSlope="10" maxSlope="70" minElevation="-100" maxElevation="100">
          <localRotationOffset x="1" y="2" z="3" />
          <rotationRange x="4" y="5" z="6" />
          <positionOffset x="7" y="8" z="9" />
        </transformParams>
      </HarvestableSetup.DefaultHarvestableSetup>
    `,
  );
  await writeXml(
    xmlCacheDir,
    mineableSetupPath,
    `
      <HarvestableSetup.MineableRockHarvestableSetup respawnInSlotTime="3600" __type="HarvestableSetup" __ref="mineable-setup-guid" __path="${mineableSetupPath}">
        <harvestBehaviour>
          <harvestConditions>
            <HarvestConditionHealth healthRatio="0.25" />
          </harvestConditions>
          <despawnTimer despawnTimeSeconds="900" additionalWaitForNearbyPlayersSeconds="60" />
        </harvestBehaviour>
        <transformParams minScale="1" maxScale="1" terrainNormalAlignment="1" minZOffset="0" maxZOffset="0" minSlope="0" maxSlope="90" minElevation="-10000" maxElevation="10000">
          <localRotationOffset x="0" y="0" z="0" />
          <rotationRange x="0" y="0" z="360" />
          <positionOffset x="0" y="0" z="0" />
        </transformParams>
      </HarvestableSetup.MineableRockHarvestableSetup>
    `,
  );
  await writeXml(
    xmlCacheDir,
    lootSetupPath,
    `<HarvestableSetup.LootCrateHarvestableSetup __type="HarvestableSetup" __ref="loot-setup-guid" __path="${lootSetupPath}" />`,
  );

  const rows = await extractDataCoreMiningHarvestableSetups({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph()),
  });

  assert.deepEqual(rows, [
    {
      ref: 'default-setup-guid',
      path: defaultSetupPath,
      setupClass: 'DefaultHarvestableSetup',
      respawnInSlotTime: '120',
      specialHarvestableString: 'Rare',
      harvestConditionTypes: 'HarvestConditionHealth;HarvestConditionInteraction;HarvestConditionMovement',
      healthRatio: '0',
      includeAttachedChildren: '0',
      allInteractionsClearSpawnPoint: '1',
      movementDistance: '5',
      despawnTimeSeconds: '600',
      additionalWaitForNearbyPlayersSeconds: '300',
      minScale: '0.5',
      maxScale: '1.5',
      terrainNormalAlignment: '1',
      minZOffset: '-2',
      maxZOffset: '3',
      minSlope: '10',
      maxSlope: '70',
      minElevation: '-100',
      maxElevation: '100',
      localRotationOffset: '1,2,3',
      rotationRange: '4,5,6',
      positionOffset: '7,8,9',
    },
    {
      ref: 'mineable-setup-guid',
      path: mineableSetupPath,
      setupClass: 'MineableRockHarvestableSetup',
      respawnInSlotTime: '3600',
      specialHarvestableString: '',
      harvestConditionTypes: 'HarvestConditionHealth',
      healthRatio: '0.25',
      includeAttachedChildren: '',
      allInteractionsClearSpawnPoint: '',
      movementDistance: '',
      despawnTimeSeconds: '900',
      additionalWaitForNearbyPlayersSeconds: '60',
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
      providerPath,
      'provider-guid',
      'HarvestableProviderPreset.HPP_Stanton1',
      'HarvestableProviderPreset',
      'HPP_Stanton1',
    ),
    node(
      defaultSetupPath,
      'default-setup-guid',
      'HarvestableSetup.DefaultHarvestableSetup',
      'HarvestableSetup',
      'DefaultHarvestableSetup',
    ),
    node(
      mineableSetupPath,
      'mineable-setup-guid',
      'HarvestableSetup.MineableRockHarvestableSetup',
      'HarvestableSetup',
      'MineableRockHarvestableSetup',
    ),
    node(
      lootSetupPath,
      'loot-setup-guid',
      'HarvestableSetup.LootCrateHarvestableSetup',
      'HarvestableSetup',
      'LootCrateHarvestableSetup',
    ),
    node(
      harvestablePath,
      'mineable-entity-guid',
      'EntityClassDefinition.AgriciumRock',
      'EntityClassDefinition',
      'AgriciumRock',
    ),
  ];

  return {
    source: 'datacore-record-graph',
    recordCount: records.length,
    records,
    indexes: {
      byRef: Object.fromEntries(records.map((record) => [record.ref, record.path])),
      byPath: Object.fromEntries(records.map((record, index) => [record.path, index])),
      byRootType: {
        HarvestableProviderPreset: [providerPath],
        HarvestableSetup: [defaultSetupPath, mineableSetupPath, lootSetupPath],
        EntityClassDefinition: [harvestablePath],
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
