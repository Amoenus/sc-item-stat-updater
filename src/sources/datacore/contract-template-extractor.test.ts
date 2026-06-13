import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreContractTemplates } from './contract-template-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

test('extractDataCoreContractTemplates emits template display and objective facts', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-contract-template-'));
  const templatePath = 'libs/foundry/records/contracts/contracttemplates/test_template.xml';
  await fs.mkdir(path.dirname(path.join(xmlCacheDir, templatePath)), { recursive: true });
  await fs.writeFile(
    path.join(xmlCacheDir, templatePath),
    `
      <ContractTemplate.TestTemplate owner="owner-guid" __type="ContractTemplate" __ref="template-guid" __path="${templatePath}">
        <contractClass>
          <ContractClass_Contract>
            <additionalParams hasCompleteButton="1" handlesAbandonRequest="0" canBeShared="1" displayAlliedMarkers="1" onlyOwnerCanComplete="0" />
            <autoFinishSettings failIfSentToPrison="1" failIfBecameCriminal="0" failIfLeavePrison="1">
              <contractDeadline missionCompletionTime="30" missionAutoEnd="1" missionResultAfterTimerEnd="Failed" remainingTimeToShowTimer="5" />
            </autoFinishSettings>
          </ContractClass_Contract>
        </contractClass>
        <contractDisplayInfo>
          <ContractDisplayInfo type="type-guid" illegal="0" showLifeTimeInMobiGlas="1" preShowObjectives="0" />
        </contractDisplayInfo>
        <contractProperties>
          <MissionProperty missionVariableName="MissionLocation_BP">
            <value>
              <MissionPropertyValue_Location>
                <resourceTags>
                  <Reference value="location-guid" />
                </resourceTags>
              </MissionPropertyValue_Location>
            </value>
          </MissionProperty>
          <MissionProperty extendedTextToken="Danger">
            <value>
              <MissionPropertyValue_StringHash>
                <options>
                  <MissionPropertyValueOption_StringHash textId="@danger_low" weighting="1" />
                </options>
              </MissionPropertyValue_StringHash>
            </value>
          </MissionProperty>
        </contractProperties>
        <objectiveTokens>
          <ObjectiveToken id="objective-guid" debugName="Main" startsActive="1">
            <objectiveHandler>
              <ObjectiveHandler_NearLocation module="libs/subsumption/missions/test.xml">
                <travelObjectiveInfo shortDescription="@travel_short" longDescription="@travel_long" objectiveMarkerLabel="@LOC_PLACEHOLDER" />
                <returnObjectiveInfo shortDescription="@return_short" longDescription="@return_long" objectiveMarkerLabel="@return_marker" />
                <navPointSpawnInfo>
                  <NavPointSpawnInformation name="@nav_name" />
                </navPointSpawnInfo>
              </ObjectiveHandler_NearLocation>
            </objectiveHandler>
            <displayInfo shortDescription="@objective_short" longDescription="@objective_long" objectiveMarkerLabel="@objective_marker" />
            <overrideMissionDetailsDisplayInfo titleOverride="@override_title" descriptionOverride="@override_desc" />
          </ObjectiveToken>
        </objectiveTokens>
      </ContractTemplate.TestTemplate>
    `,
  );

  assert.deepEqual(
    await extractDataCoreContractTemplates({
      xmlCacheDir,
      graph: createDataCoreRecordGraphLookup(graphFixture(templatePath)),
    }),
    [
      {
        templateClass: 'TestTemplate',
        contractClassType: 'ContractClass_Contract',
        ownerGuid: 'owner-guid',
        ownerClass: 'OwnerFaction',
        displayTypeGuid: 'type-guid',
        displayTypeClass: 'Bounty',
        illegal: '0',
        showLifeTimeInMobiGlas: '1',
        preShowObjectives: '0',
        hasCompleteButton: '1',
        handlesAbandonRequest: '0',
        canBeShared: '1',
        displayAlliedMarkers: '1',
        onlyOwnerCanComplete: '0',
        failIfSentToPrison: '1',
        failIfBecameCriminal: '0',
        failIfLeavePrison: '1',
        missionCompletionTime: '30',
        missionAutoEnd: '1',
        missionResultAfterTimerEnd: 'Failed',
        remainingTimeToShowTimer: '5',
        objectiveCount: '1',
        missionPropertyCount: '2',
        objectiveHandlerTypes: 'ObjectiveHandler_NearLocation',
        objectiveHandlerModules: 'libs/subsumption/missions/test.xml',
        objectiveDisplayKeys: 'objective_long | objective_marker | objective_short',
        travelObjectiveKeys: 'travel_long | travel_short',
        returnObjectiveKeys: 'return_long | return_marker | return_short',
        overrideMissionDetailsKeys: 'override_desc | override_title',
        navPointNameKeys: 'nav_name',
        stringHashKeys: 'danger_low',
        locationTagGuids: 'location-guid',
        locationTagClasses: 'Area18',
        recordGuid: 'template-guid',
        recordPath: templatePath,
      },
    ],
  );
});

function graphFixture(templatePath: string): DataCoreRecordGraph {
  return {
    source: 'datacore-record-graph',
    recordCount: 4,
    records: [
      {
        path: templatePath,
        ref: 'template-guid',
        rootTag: 'ContractTemplate.TestTemplate',
        rootType: 'ContractTemplate',
        entityClass: 'TestTemplate',
        localizationKeys: [],
        referencedGuids: [],
      },
      record('owner-guid', 'OwnerFaction'),
      record('type-guid', 'Bounty'),
      record('location-guid', 'Area18'),
    ],
    indexes: {
      byRef: {
        'template-guid': templatePath,
        'owner-guid': 'ownerfaction.xml',
        'type-guid': 'bounty.xml',
        'location-guid': 'area18.xml',
      },
      byPath: {},
      byRootType: {},
      byEntityClass: {},
      byLocalizationKey: {},
      byReferencedGuid: {},
    },
  };
}

function record(ref: string, entityClass: string) {
  return {
    path: `${entityClass.toLowerCase()}.xml`,
    ref,
    rootTag: `Record.${entityClass}`,
    rootType: 'Record',
    entityClass,
    localizationKeys: [],
    referencedGuids: [],
  };
}
