import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreContractGenerators } from './contract-generator-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

test('extractDataCoreContractGenerators emits generated contract variant facts', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-contract-generator-'));
  const generatorPath = 'libs/foundry/records/contracts/contractgenerator/test_generator.xml';
  await fs.mkdir(path.dirname(path.join(xmlCacheDir, generatorPath)), { recursive: true });
  await fs.writeFile(
    path.join(xmlCacheDir, generatorPath),
    `
      <ContractGenerator.TestGenerator __type="ContractGenerator" __ref="generator-guid" __path="${generatorPath}">
        <generators>
          <ContractGeneratorHandler_Career notForRelease="0" workInProgress="1" debugName="Career_Handler" factionReputation="faction-guid" reputationScope="scope-guid">
            <contractParams>
              <stringParamOverrides>
                <ContractStringParam param="Contractor" value="@contractor_from" />
              </stringParamOverrides>
            </contractParams>
            <introContracts>
              <Contract id="contract-guid" notForRelease="0" workInProgress="0" debugName="Intro_Contract" template="template-guid">
                <paramOverrides>
                  <stringParamOverrides>
                    <ContractStringParam param="Title" value="@intro_title" />
                    <ContractStringParam param="Description" value="@intro_desc" />
                  </stringParamOverrides>
                  <propertyOverrides>
                    <MissionProperty missionVariableName="Mission_Title_StringHash">
                      <value>
                        <MissionPropertyValue_StringHash>
                          <options>
                            <MissionPropertyValueOption_StringHash textId="@intro_title_001" weighting="1" />
                          </options>
                        </MissionPropertyValue_StringHash>
                      </value>
                    </MissionProperty>
                    <MissionProperty missionVariableName="Mission_Description_StringHash">
                      <value>
                        <MissionPropertyValue_StringHash>
                          <options>
                            <MissionPropertyValueOption_StringHash textId="@intro_desc_001" weighting="1" />
                            <MissionPropertyValueOption_StringHash textId="@intro_desc_002" weighting="1" />
                          </options>
                        </MissionPropertyValue_StringHash>
                      </value>
                    </MissionProperty>
                    <MissionProperty missionVariableName="MissionLocation">
                      <value>
                        <MissionPropertyValue_Location>
                          <matchConditions>
                            <DataSetMatchCondition_TagSearch>
                              <tagSearch>
                                <TagSearchTerm>
                                  <positiveTags>
                                    <Reference value="location-guid" />
                                  </positiveTags>
                                </TagSearchTerm>
                              </tagSearch>
                            </DataSetMatchCondition_TagSearch>
                          </matchConditions>
                        </MissionPropertyValue_Location>
                      </value>
                    </MissionProperty>
                  </propertyOverrides>
                </paramOverrides>
                <generationParams>
                  <ContractGenerationParams_Legacy maxInstances="5" maxInstancesPerPlayer="1" respawnTime="5" respawnTimeVariation="2" />
                </generationParams>
                <contractLifeTime>
                  <ContractLifeTime instanceLifeTime="30" instanceLifeTimeVariation="4" />
                </contractLifeTime>
                <contractResults contractBuyInAmount="10" timeToComplete="20">
                  <difficulty>
                    <ContractDifficulty difficultyProfile="difficulty-guid" mechanicalSkill="Hands_free" mentalLoad="Low" riskOfLoss="Safe" gameKnowledge="Basic" />
                  </difficulty>
                </contractResults>
              </Contract>
            </introContracts>
          </ContractGeneratorHandler_Career>
        </generators>
      </ContractGenerator.TestGenerator>
    `,
  );

  const graph = createDataCoreRecordGraphLookup(graphFixture(generatorPath));

  assert.deepEqual(await extractDataCoreContractGenerators({ xmlCacheDir, graph }), [
    {
      generatorClass: 'TestGenerator',
      handlerType: 'ContractGeneratorHandler_Career',
      handlerDebugName: 'Career_Handler',
      handlerNotForRelease: '0',
      handlerWorkInProgress: '1',
      factionReputationGuid: 'faction-guid',
      reputationScopeGuid: 'scope-guid',
      contractSection: 'introContracts',
      contractId: 'contract-guid',
      contractDebugName: 'Intro_Contract',
      contractNotForRelease: '0',
      contractWorkInProgress: '0',
      templateGuid: 'template-guid',
      templateClass: 'TemplateClass',
      titleKey: 'intro_title',
      descriptionKey: 'intro_desc',
      contractorKey: 'contractor_from',
      titleVariantKeys: 'intro_title_001',
      descriptionVariantKeys: 'intro_desc_001 | intro_desc_002',
      stringParamOverrides: 'Contractor=contractor_from | Description=intro_desc | Title=intro_title',
      locationTagGuids: 'location-guid',
      locationTagClasses: 'Area18',
      maxInstances: '5',
      maxInstancesPerPlayer: '1',
      respawnTime: '5',
      respawnTimeVariation: '2',
      instanceLifeTime: '30',
      instanceLifeTimeVariation: '4',
      contractBuyInAmount: '10',
      timeToComplete: '20',
      difficultyProfileGuid: 'difficulty-guid',
      difficultyProfileClass: 'EasyDifficulty',
      mechanicalSkill: 'Hands_free',
      mentalLoad: 'Low',
      riskOfLoss: 'Safe',
      gameKnowledge: 'Basic',
      recordGuid: 'generator-guid',
      recordPath: generatorPath,
    },
  ]);
});

function graphFixture(generatorPath: string): DataCoreRecordGraph {
  return {
    source: 'datacore-record-graph',
    recordCount: 4,
    records: [
      {
        path: generatorPath,
        ref: 'generator-guid',
        rootTag: 'ContractGenerator.TestGenerator',
        rootType: 'ContractGenerator',
        entityClass: 'TestGenerator',
        localizationKeys: [],
        referencedGuids: [],
      },
      record('template-guid', 'TemplateClass'),
      record('location-guid', 'Area18'),
      record('difficulty-guid', 'EasyDifficulty'),
    ],
    indexes: {
      byRef: {
        'generator-guid': generatorPath,
        'template-guid': 'templateclass.xml',
        'location-guid': 'area18.xml',
        'difficulty-guid': 'easydifficulty.xml',
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
