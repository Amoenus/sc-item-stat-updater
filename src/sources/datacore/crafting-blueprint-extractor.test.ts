import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreCraftingBlueprints } from './crafting-blueprint-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

const blueprintPath = 'libs/foundry/records/crafting/blueprints/aegs_component_blueprint.xml';
const targetPath = 'libs/foundry/records/entities/scitem/ships/powerplant/powr_aegs_s01_charger.xml';

test('extractDataCoreCraftingBlueprints resolves target items by normalized graph entity class refs', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-crafting-blueprints-'));
  await writeXml(
    xmlCacheDir,
    blueprintPath,
    `
      <CraftingBlueprintRecord.AEGS_Component_Blueprint __type="CraftingBlueprintRecord" __ref="blueprint-ref" __path="${blueprintPath}">
        <processSpecificData>
          <CraftingProcess_Creation entityClass="POWR_AEGS_S01_CHARGER_SCItem" />
        </processSpecificData>
        <CraftingRecipeCosts>
          <CraftingCost_Resource resource="resource-guid" minQuality="2">
            <quantity>
              <SStandardCargoUnit standardCargoUnits="12" />
            </quantity>
          </CraftingCost_Resource>
        </CraftingRecipeCosts>
      </CraftingBlueprintRecord.AEGS_Component_Blueprint>
    `,
  );

  const rows = await extractDataCoreCraftingBlueprints({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph()),
  });

  assert.deepEqual(rows, [
    {
      ref: 'blueprint-ref',
      path: blueprintPath,
      blueprintClass: 'AEGS_Component_Blueprint',
      targetEntityClassGuid: 'target-ref',
      targetEntityClass: 'powr_aegs_s01_charger',
      targetItemNameKey: 'item_NamePOWR_AEGS_S01_Charger',
      recipeCosts: '[{"resource":"resource-guid","minQuality":2,"amount":12}]',
    },
  ]);
});

test('extractDataCoreCraftingBlueprints prefers graph name attributes over key-name heuristics', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-crafting-blueprints-name-'));
  await writeXml(
    xmlCacheDir,
    blueprintPath,
    `
      <CraftingBlueprintRecord.AEGS_Component_Blueprint __type="CraftingBlueprintRecord" __ref="blueprint-ref" __path="${blueprintPath}">
        <processSpecificData>
          <CraftingProcess_Creation entityClass="target-ref" />
        </processSpecificData>
      </CraftingBlueprintRecord.AEGS_Component_Blueprint>
    `,
  );
  const graph = makeGraph();
  graph.records[1].localizationKeys = [
    { attribute: 'description', key: 'item_NameHeuristic_Wrong' },
    { attribute: 'displayName', key: 'ui_PowerPlant_Display' },
  ];

  const rows = await extractDataCoreCraftingBlueprints({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(graph),
  });

  assert.equal(rows[0].targetItemNameKey, 'ui_PowerPlant_Display');
});

test('extractDataCoreCraftingBlueprints does not use name heuristics when graph name is placeholder', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-crafting-blueprints-placeholder-name-'));
  await writeXml(
    xmlCacheDir,
    blueprintPath,
    `
      <CraftingBlueprintRecord.AEGS_Component_Blueprint __type="CraftingBlueprintRecord" __ref="blueprint-ref" __path="${blueprintPath}">
        <processSpecificData>
          <CraftingProcess_Creation entityClass="target-ref" />
        </processSpecificData>
      </CraftingBlueprintRecord.AEGS_Component_Blueprint>
    `,
  );
  const graph = makeGraph();
  graph.records[1].localizationKeys = [
    { attribute: 'Name', key: 'LOC_PLACEHOLDER' },
    { attribute: 'description', key: 'item_NameHeuristic_Wrong' },
  ];

  const rows = await extractDataCoreCraftingBlueprints({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(graph),
  });

  assert.equal(rows[0].targetItemNameKey, '');
});

test('extractDataCoreCraftingBlueprints prefers unique graph refs for target and resource links', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-crafting-blueprints-refs-'));
  await writeXml(
    xmlCacheDir,
    blueprintPath,
    `
      <CraftingBlueprintRecord.AEGS_Component_Blueprint __type="CraftingBlueprintRecord" __ref="blueprint-ref" __path="${blueprintPath}">
        <processSpecificData>
          <CraftingProcess_Creation entityClass="stale-target-ref" />
        </processSpecificData>
        <CraftingRecipeCosts>
          <CraftingCost_Resource resource="stale-resource-guid" minQuality="3">
            <quantity>
              <SStandardCargoUnit standardCargoUnits="8" />
            </quantity>
          </CraftingCost_Resource>
        </CraftingRecipeCosts>
      </CraftingBlueprintRecord.AEGS_Component_Blueprint>
    `,
  );
  const graph = makeGraph();
  graph.records[0].referencedGuids = ['target-ref', 'resource-guid'];
  graph.records[0].referencedGuidAttributes = [
    { attribute: 'entityClass', value: 'target-ref' },
    { attribute: 'resource', value: 'resource-guid' },
  ];

  const rows = await extractDataCoreCraftingBlueprints({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(graph),
  });

  assert.equal(rows[0].targetEntityClassGuid, 'target-ref');
  assert.equal(rows[0].targetEntityClass, 'powr_aegs_s01_charger');
  assert.equal(rows[0].recipeCosts, '[{"resource":"resource-guid","minQuality":3,"amount":8}]');
});

async function writeXml(xmlCacheDir: string, recordPath: string, xml: string): Promise<void> {
  const xmlPath = path.join(xmlCacheDir, recordPath);
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(xmlPath, xml, 'utf8');
}

function makeGraph(): DataCoreRecordGraph {
  return {
    source: 'datacore-record-graph',
    recordCount: 2,
    records: [
      {
        path: blueprintPath,
        ref: 'blueprint-ref',
        rootTag: 'CraftingBlueprintRecord.AEGS_Component_Blueprint',
        rootType: 'CraftingBlueprintRecord',
        entityClass: 'AEGS_Component_Blueprint',
        localizationKeys: [],
        referencedGuids: [],
      },
      {
        path: targetPath,
        ref: 'target-ref',
        rootTag: 'EntityClassDefinition.powr_aegs_s01_charger',
        rootType: 'EntityClassDefinition',
        entityClass: 'powr_aegs_s01_charger',
        localizationKeys: [{ attribute: 'Name', key: 'item_NamePOWR_AEGS_S01_Charger' }],
        referencedGuids: [],
      },
    ],
    indexes: {
      byRef: { 'blueprint-ref': blueprintPath, 'target-ref': targetPath },
      byPath: { [blueprintPath]: 0, [targetPath]: 1 },
      byRootType: { CraftingBlueprintRecord: [blueprintPath], EntityClassDefinition: [targetPath] },
      byEntityClass: {
        AEGS_Component_Blueprint: [blueprintPath],
        powr_aegs_s01_charger: [targetPath],
      },
      byLocalizationKey: { item_NamePOWR_AEGS_S01_Charger: [targetPath] },
      byReferencedGuid: {},
    },
  };
}
