import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreMiningSubHarvestableConfigs } from './mining-sub-harvestable-config-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph, DataCoreRecordNode } from './types';

const directConfigPath = 'libs/foundry/records/harvestable/slotpresets/cave_aberdeen_rich.xml';
const multiConfigPath = 'libs/foundry/records/harvestable/slotpresets/cave_prison_harvestables.xml';
const harvestablePresetPath = 'libs/foundry/records/harvestable/harvestablepresets/fpsmining_aphorite.xml';
const mineableEntityPath = 'libs/foundry/records/entities/mineable/aphoritemineablerockfps.xml';
const lootEntityPath = 'libs/foundry/records/entities/loot/lootcrate.xml';
const setupPath = 'libs/foundry/records/harvestable/harvestablesetups/mineablerockharvestablesetup.xml';

test('extractDataCoreMiningSubHarvestableConfigs extracts mining slots from direct, manual, and referenced configs', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-mining-sub-harvestable-configs-'));
  await writeXml(
    xmlCacheDir,
    directConfigPath,
    `
      <SubHarvestableConfigRecord.Cave_Aberdeen_Rich __type="SubHarvestableConfigRecord" __ref="1a3fdfbe-bd2e-4db1-b175-060c11db30fc" __path="${directConfigPath}">
        <subConfig initialSlotsProbability="0.8" configRespawnTimeMultiplier="1">
          <subHarvestables>
            <SubHarvestableSlot harvestable="b4dbb414-4946-437a-870b-0df49007603b" relativeProbability="42" harvestableRespawnTimeMultiplier="2" harvestableSetup="0aa9921e-8de0-487e-bc87-1d457c56d74f">
              <geometries>
                <HarvestableGeometry tag="9c6ef328-5118-4882-9ad4-2f391322af21" />
              </geometries>
              <relativeProbabilityDeepest>
                <OptionalProbability probability="0.4" />
              </relativeProbabilityDeepest>
            </SubHarvestableSlot>
            <SubHarvestableSlot harvestableEntityClass="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" relativeProbability="900" />
          </subHarvestables>
        </subConfig>
      </SubHarvestableConfigRecord.Cave_Aberdeen_Rich>
    `,
  );
  await writeXml(
    xmlCacheDir,
    multiConfigPath,
    `
      <SubHarvestableMultiConfigRecord.Cave_Prison_Harvestables __type="SubHarvestableMultiConfigRecord" __ref="22222222-2222-2222-2222-222222222222" __path="${multiConfigPath}">
        <multiConfig ignoreAttachableTagsForTaggedConfigs="1">
          <taggedConfigs>
            <TaggedSubHarvestableConfig name="FPS mineables">
              <tagList>
                <Reference value="4ae42675-463a-47fc-a90a-069b05796920" />
              </tagList>
              <subConfig>
                <SubHarvestableConfigSingleManual>
                  <subConfigManual initialSlotsProbability="0.7" configRespawnTimeMultiplier="3">
                    <subHarvestables>
                      <SubHarvestableSlot harvestableEntityClass="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" relativeProbability="0.4" />
                    </subHarvestables>
                  </subConfigManual>
                </SubHarvestableConfigSingleManual>
              </subConfig>
            </TaggedSubHarvestableConfig>
            <TaggedSubHarvestableConfig name="Mineables">
              <subConfig>
                <SubHarvestableConfigSingleRef subConfigRef="1a3fdfbe-bd2e-4db1-b175-060c11db30fc" />
              </subConfig>
            </TaggedSubHarvestableConfig>
          </taggedConfigs>
        </multiConfig>
      </SubHarvestableMultiConfigRecord.Cave_Prison_Harvestables>
    `,
  );
  await writeXml(
    xmlCacheDir,
    harvestablePresetPath,
    `
      <HarvestablePreset.FPSMining_Aphorite entityClass="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" __type="HarvestablePreset" __ref="b4dbb414-4946-437a-870b-0df49007603b" __path="${harvestablePresetPath}" />
    `,
  );

  const rows = await extractDataCoreMiningSubHarvestableConfigs({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph()),
  });

  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], {
    ref: '1a3fdfbe-bd2e-4db1-b175-060c11db30fc',
    path: directConfigPath,
    configClass: 'Cave_Aberdeen_Rich',
    configType: 'single',
    taggedConfigName: '',
    tagGuids: '',
    initialSlotsProbability: '0.8',
    configRespawnTimeMultiplier: '1',
    slotIndex: '0',
    harvestableGuid: 'b4dbb414-4946-437a-870b-0df49007603b',
    harvestableClass: 'FPSMining_Aphorite',
    harvestablePath: harvestablePresetPath,
    harvestableEntityGuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    harvestableEntityClass: 'AphoriteMineableRockFPS',
    harvestableEntityPath: mineableEntityPath,
    harvestableSetupGuid: '0aa9921e-8de0-487e-bc87-1d457c56d74f',
    harvestableSetupClass: 'MineableRockHarvestableSetup',
    relativeProbability: '42',
    deepestRelativeProbability: '0.4',
    harvestableRespawnTimeMultiplier: '2',
    geometryTags: '9c6ef328-5118-4882-9ad4-2f391322af21',
    referencedConfigGuid: '',
    referencedConfigClass: '',
    referencedConfigPath: '',
  });
  assert.equal(rows[1].configType, 'multi-manual');
  assert.equal(rows[1].taggedConfigName, 'FPS mineables');
  assert.equal(rows[1].tagGuids, '4ae42675-463a-47fc-a90a-069b05796920');
  assert.equal(rows[1].harvestableEntityGuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  assert.equal(rows[2].configType, 'multi-ref');
  assert.equal(rows[2].taggedConfigName, 'Mineables');
  assert.equal(rows[2].referencedConfigGuid, '1a3fdfbe-bd2e-4db1-b175-060c11db30fc');
  assert.equal(rows[2].referencedConfigClass, 'Cave_Aberdeen_Rich');
});

async function writeXml(xmlCacheDir: string, recordPath: string, xml: string): Promise<void> {
  const xmlPath = path.join(xmlCacheDir, recordPath);
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(xmlPath, xml, 'utf8');
}

function makeGraph(): DataCoreRecordGraph {
  const records: DataCoreRecordNode[] = [
    node(directConfigPath, '1a3fdfbe-bd2e-4db1-b175-060c11db30fc', 'SubHarvestableConfigRecord', 'Cave_Aberdeen_Rich'),
    node(multiConfigPath, '22222222-2222-2222-2222-222222222222', 'SubHarvestableMultiConfigRecord', 'Cave_Prison_Harvestables'),
    node(harvestablePresetPath, 'b4dbb414-4946-437a-870b-0df49007603b', 'HarvestablePreset', 'FPSMining_Aphorite'),
    node(mineableEntityPath, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'EntityClassDefinition', 'AphoriteMineableRockFPS'),
    node(lootEntityPath, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'EntityClassDefinition', 'LootCrate'),
    node(setupPath, '0aa9921e-8de0-487e-bc87-1d457c56d74f', 'HarvestableSetup', 'MineableRockHarvestableSetup'),
  ];

  return {
    source: 'datacore-record-graph',
    recordCount: records.length,
    records,
    indexes: {
      byRef: Object.fromEntries(records.map((record) => [record.ref, record.path])),
      byPath: Object.fromEntries(records.map((record, index) => [record.path, index])),
      byRootType: {
        SubHarvestableConfigRecord: [directConfigPath],
        SubHarvestableMultiConfigRecord: [multiConfigPath],
      },
      byEntityClass: {},
      byLocalizationKey: {},
      byReferencedGuid: {},
    },
  };
}

function node(pathValue: string, ref: string, rootType: string, entityClass: string): DataCoreRecordNode {
  return {
    path: pathValue,
    ref,
    rootTag: `${rootType}.${entityClass}`,
    rootType,
    entityClass,
    localizationKeys: [],
    referencedGuids: [],
  };
}
