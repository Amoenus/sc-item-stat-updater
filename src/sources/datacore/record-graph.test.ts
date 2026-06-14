import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildDataCoreRecordGraph } from './record-graph';

test('buildDataCoreRecordGraph indexes DataForge XML records by graph keys', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-record-graph-'));
  const vehiclePath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'entities', 'spaceships', 'ship.xml');
  const manufacturerPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'scitemmanufacturer', 'aegs.xml');
  await fs.mkdir(path.dirname(vehiclePath), { recursive: true });
  await fs.mkdir(path.dirname(manufacturerPath), { recursive: true });

  await fs.writeFile(
    vehiclePath,
    `
      <EntityClassDefinition.AEGS_Avenger __ref="11111111-1111-1111-1111-111111111111" __type="EntityClassDefinition" __path="libs/foundry/records/entities/spaceships/aegs_avenger.xml" vehicleName="@vehicle_Name_AEGS_Avenger">
        <Vehicle
          vehicleDescription="vehicle_Desc_AEGS_Avenger"
          Manufacturer="33333333-3333-4333-8333-333333333333"
        />
        <Mineable depositName="@hud_mining_asteroid_name_5" />
        <Hauling orderDisplayName="@Salvage_Ship_Component_Shield_Generator_S1_Name" />
        <Location callout1="@Pyro3_Outpost_callout1" callout2="@LOC_PLACEHOLDER" />
        <MissionPropertyValueOption_StringHash textId="@mission_variant_text" />
        <Contract id="contract-guid">
        <MissionProperty missionVariableName="Mission_Title_StringHash">
          <MissionPropertyValueOption_StringHash textId="@mission_title_variant" />
        </MissionProperty>
        </Contract>
        <Override titleOverride="@mission_override_title" descriptionOverride="@mission_override_desc" />
        <ObjectiveToken>
          <displayInfo shortDescription="@objective_short" longDescription="@objective_long" objectiveMarkerLabel="@objective_marker" />
          <ObjectiveHandler>
            <travelObjectiveInfo shortDescription="@travel_short" longDescription="@travel_long" objectiveMarkerLabel="@travel_marker" />
            <returnObjectiveInfo shortDescription="@return_short" longDescription="@return_long" objectiveMarkerLabel="@return_marker" />
            <NavPointSpawnInformation name="@nav_name" />
          </ObjectiveHandler>
        </ObjectiveToken>
        <SReputationContextBBPropertyParams name="entityDescription">
          <dynamicProperty>
            <SBBDynamicPropertyLocString value="@HeadHunters_RepUI_Description" />
          </dynamicProperty>
        </SReputationContextBBPropertyParams>
        <CommodityComponentParams name="@items_commodities_atlasium" description="@items_commodities_atlasium_desc" />
        <SCItemPurchasableParams displayType="@items_commodities_type_alloy" ShortName="@items_commodities_atlasium_short" shortName="@items_commodities_atlasium_short_lower" />
        <Placeholder Name="@LOC_PLACEHOLDER" Description="@LOC_UNINITIALIZED" />
        <Fallback Name="Raw entity name is not a localization reference" />
        <Reference value="22222222-2222-2222-2222-222222222222" />
        <Reference value="22222222-2222-2222-2222-222222222222" />
      </EntityClassDefinition.AEGS_Avenger>
    `,
  );
  await fs.writeFile(
    manufacturerPath,
    `
      <Manufacturer __ref="22222222-2222-2222-2222-222222222222" __type="Manufacturer" __path="libs/foundry/records/scitemmanufacturer/aegs.xml" Name="@manufacturer_Name_AEGS">
        <Details Description="@manufacturer_Desc_AEGS" />
      </Manufacturer>
    `,
  );

  const graph = await buildDataCoreRecordGraph({ xmlCacheDir });

  assert.equal(graph.source, 'datacore-record-graph');
  assert.equal(graph.recordCount, 2);
  assert.equal(
    graph.indexes.byRef['11111111-1111-1111-1111-111111111111'],
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  );
  assert.equal(graph.indexes.byPath['libs/foundry/records/entities/spaceships/aegs_avenger.xml'], 0);
  assert.deepEqual(graph.indexes.byRootType.EntityClassDefinition, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.indexes.byEntityClass.AEGS_Avenger, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.indexes.byLocalizationKey.vehicle_Name_AEGS_Avenger, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.indexes.byLocalizationKey.items_commodities_atlasium, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.indexes.byLocalizationKey.items_commodities_atlasium_desc, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.indexes.byLocalizationKey.items_commodities_type_alloy, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.indexes.byLocalizationKey.items_commodities_atlasium_short, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.indexes.byLocalizationKey.items_commodities_atlasium_short_lower, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.indexes.byLocalizationKey.hud_mining_asteroid_name_5, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.indexes.byLocalizationKey.Salvage_Ship_Component_Shield_Generator_S1_Name, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.indexes.byLocalizationKey.Pyro3_Outpost_callout1, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.indexes.byLocalizationKey.mission_variant_text, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.indexes.byLocalizationKey.mission_title_variant, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.equal(
    graph.records[0]?.localizationKeys.some(
      (reference) =>
        reference.attribute === 'contract:contract-guid:Mission_Title_StringHash.textId' &&
        reference.key === 'mission_title_variant',
    ),
    true,
  );
  assert.deepEqual(graph.indexes.byLocalizationKey.mission_override_title, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.indexes.byLocalizationKey.mission_override_desc, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.indexes.byLocalizationKey.objective_short, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.indexes.byLocalizationKey.travel_long, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.indexes.byLocalizationKey.return_marker, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.indexes.byLocalizationKey.nav_name, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.indexes.byLocalizationKey.HeadHunters_RepUI_Description, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.equal(
    graph.records[0]?.localizationKeys.some(
      (reference) =>
        reference.attribute === 'reputationProperty:entityDescription' &&
        reference.key === 'HeadHunters_RepUI_Description',
    ),
    true,
  );
  assert.equal(graph.indexes.byLocalizationKey['Raw entity name is not a localization reference'], undefined);
  assert.equal(graph.indexes.byLocalizationKey.LOC_PLACEHOLDER, undefined);
  assert.equal(graph.indexes.byLocalizationKey.LOC_UNINITIALIZED, undefined);
  assert.deepEqual(graph.indexes.byLocalizationKey.manufacturer_Desc_AEGS, [
    'libs/foundry/records/scitemmanufacturer/aegs.xml',
  ]);
  assert.equal(graph.records[0]?.localizationKeys.some((reference) => reference.key === 'LOC_PLACEHOLDER'), true);
  assert.equal(graph.records[0]?.localizationKeys.some((reference) => reference.key === 'LOC_UNINITIALIZED'), true);
  assert.deepEqual(graph.indexes.byReferencedGuid['22222222-2222-2222-2222-222222222222'], [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.indexes.byReferencedGuid['33333333-3333-4333-8333-333333333333'], [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.records[0]?.referencedGuidAttributes, [
    { attribute: 'value', value: '22222222-2222-2222-2222-222222222222' },
    { attribute: 'Manufacturer', value: '33333333-3333-4333-8333-333333333333' },
  ]);
  assert.equal(graph.indexes.byReferencedGuid['11111111-1111-1111-1111-111111111111'], undefined);
});

test('buildDataCoreRecordGraph emits effective contract string params by contract id', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-record-graph-contract-params-'));
  const generatorPath = path.join(
    xmlCacheDir,
    'libs',
    'foundry',
    'records',
    'contracts',
    'contractgenerator',
    'test_generator.xml',
  );
  await fs.mkdir(path.dirname(generatorPath), { recursive: true });
  await fs.writeFile(
    generatorPath,
    `
      <ContractGenerator.TestGenerator __ref="generator-guid" __type="ContractGenerator" __path="libs/foundry/records/contracts/contractgenerator/test_generator.xml">
        <generators>
          <ContractGeneratorHandler_Career>
            <contractParams>
              <stringParamOverrides>
                <ContractStringParam param="Contractor" value="@contractor_from" />
                <ContractStringParam param="Title" value="@handler_title" />
              </stringParamOverrides>
            </contractParams>
            <introContracts>
              <Contract id="intro-contract-guid">
                <paramOverrides>
                  <stringParamOverrides>
                    <ContractStringParam param="Title" value="@intro_title" />
                    <ContractStringParam param="Description" value="@intro_desc" />
                  </stringParamOverrides>
                  <propertyOverrides>
                    <MissionProperty missionVariableName="MissionLocation">
                      <value>
                        <MissionPropertyValue_Location>
                          <Reference value="44444444-4444-4444-8444-444444444444" />
                        </MissionPropertyValue_Location>
                      </value>
                    </MissionProperty>
                  </propertyOverrides>
                </paramOverrides>
              </Contract>
            </introContracts>
            <contracts>
              <Contract id="repeatable-contract-guid">
                <paramOverrides>
                  <stringParamOverrides>
                    <ContractStringParam param="Description" value="@repeatable_desc" />
                  </stringParamOverrides>
                </paramOverrides>
              </Contract>
            </contracts>
          </ContractGeneratorHandler_Career>
        </generators>
      </ContractGenerator.TestGenerator>
    `,
  );

  const graph = await buildDataCoreRecordGraph({ xmlCacheDir });
  const record = graph.records[0];
  assert.ok(record);

  assert.equal(
    record.localizationKeys.some(
      (reference) =>
        reference.attribute === 'contract:intro-contract-guid:ContractStringParam.Contractor' &&
        reference.key === 'contractor_from',
    ),
    true,
  );
  assert.equal(
    record.localizationKeys.some(
      (reference) =>
        reference.attribute === 'contract:intro-contract-guid:ContractStringParam.Title' &&
        reference.key === 'intro_title',
    ),
    true,
  );
  assert.equal(
    record.localizationKeys.some(
      (reference) =>
        reference.attribute === 'contract:repeatable-contract-guid:ContractStringParam.Title' &&
        reference.key === 'handler_title',
    ),
    true,
  );
  assert.equal(
    record.localizationKeys.some(
      (reference) =>
        reference.attribute === 'contract:repeatable-contract-guid:ContractStringParam.Description' &&
        reference.key === 'repeatable_desc',
    ),
    true,
  );
  assert.equal(
    record.referencedGuidAttributes?.some(
      (reference) =>
        reference.attribute === 'contract:intro-contract-guid:MissionLocation.Reference.value' &&
        reference.value === '44444444-4444-4444-8444-444444444444',
    ),
    true,
  );
});
