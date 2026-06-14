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
          <ContractGeneratorHandler_Career notForRelease="0" workInProgress="1" debugName="Career_Handler" factionReputation="stale-faction-guid" reputationScope="stale-scope-guid">
            <contractParams>
              <stringParamOverrides>
                <ContractStringParam param="Contractor" value="@contractor_from_xml_fallback" />
              </stringParamOverrides>
            </contractParams>
            <introContracts>
              <Contract id="contract-guid" notForRelease="0" workInProgress="0" debugName="Intro_Contract" template="stale-template-guid">
                <paramOverrides>
                  <stringParamOverrides>
                    <ContractStringParam param="Title" value="@intro_title_xml_fallback" />
                    <ContractStringParam param="Description" value="@intro_desc_xml_fallback" />
                  </stringParamOverrides>
                  <propertyOverrides>
                    <MissionProperty missionVariableName="Mission_Title_StringHash">
                      <value>
                        <MissionPropertyValue_StringHash>
                          <options>
                            <MissionPropertyValueOption_StringHash textId="@intro_title_xml_fallback" weighting="1" />
                          </options>
                        </MissionPropertyValue_StringHash>
                      </value>
                    </MissionProperty>
                    <MissionProperty missionVariableName="Mission_Description_StringHash">
                      <value>
                        <MissionPropertyValue_StringHash>
                          <options>
                            <MissionPropertyValueOption_StringHash textId="@intro_desc_xml_fallback_001" weighting="1" />
                            <MissionPropertyValueOption_StringHash textId="@LOC_PLACEHOLDER" weighting="1" />
                            <MissionPropertyValueOption_StringHash textId="@intro_desc_xml_fallback_002" weighting="1" />
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
                                    <Reference value="location-xml-fallback-guid" />
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
                <additionalPrerequisites>
                  <ContractPrerequisite_CompletedContractTags>
                    <requiredCompletedContractTags>
                      <tags>
                        <Reference value="required-tag" />
                      </tags>
                    </requiredCompletedContractTags>
                  </ContractPrerequisite_CompletedContractTags>
                </additionalPrerequisites>
                <contractResults contractBuyInAmount="10" timeToComplete="20">
                  <contractResults>
                    <BlueprintRewards blueprintPool="blueprint-pool" chance="0.25" trigger="MissionSuccess" />
                    <ContractResult_CompletionTags>
                      <completionTags>
                        <ContractResult_CompletionTag count="1" tag="completion-tag" />
                      </completionTags>
                    </ContractResult_CompletionTags>
                  </contractResults>
                  <difficulty>
                    <ContractDifficulty difficultyProfile="stale-difficulty-guid" mechanicalSkill="Hands_free" mentalLoad="Low" riskOfLoss="Safe" gameKnowledge="Basic" />
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
      successReputationRewards: '',
      failureReputationRewards: '',
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
      blueprintRewardPoolGuids: 'blueprint-pool',
      blueprintRewards:
        '[{"blueprintPool":"blueprint-pool","chance":0.25,"trigger":"MissionSuccess","type":"BlueprintRewards"}]',
      requiredCompletedContractTags: 'required-tag',
      completionTags: 'completion-tag',
      recordGuid: 'generator-guid',
      recordPath: generatorPath,
    },
  ]);
});

test('extractDataCoreContractGenerators emits career contract rows', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-contract-generator-career-'));
  const generatorPath = 'libs/foundry/records/contracts/contractgenerator/career_generator.xml';
  await fs.mkdir(path.dirname(path.join(xmlCacheDir, generatorPath)), { recursive: true });
  await fs.writeFile(
    path.join(xmlCacheDir, generatorPath),
    `
      <ContractGenerator.CareerGenerator __type="ContractGenerator" __ref="generator-guid" __path="${generatorPath}">
        <generators>
          <ContractGeneratorHandler_Career debugName="Career_Handler" factionReputation="fallback-faction-guid">
            <contracts>
              <CareerContract id="career-contract-guid" debugName="Career_Intro" template="fallback-template-guid">
                <paramOverrides>
                  <stringParamOverrides>
                    <ContractStringParam param="Title" value="@career_title" />
                    <ContractStringParam param="Description" value="@career_desc" />
                  </stringParamOverrides>
                </paramOverrides>
                <contractResults timeToComplete="45">
                  <contractResults>
                    <BlueprintRewards blueprintPool="blueprint-pool" />
                  </contractResults>
                </contractResults>
              </CareerContract>
            </contracts>
          </ContractGeneratorHandler_Career>
        </generators>
      </ContractGenerator.CareerGenerator>
    `,
  );

  const [row] = await extractDataCoreContractGenerators({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(graphFixture(generatorPath, { ambiguousTemplate: true })),
  });

  assert.equal(row.contractId, 'career-contract-guid');
  assert.equal(row.contractDebugName, 'Career_Intro');
  assert.equal(row.factionReputationGuid, 'faction-guid');
  assert.equal(row.templateGuid, '');
  assert.equal(row.templateClass, '');
  assert.equal(row.titleKey, 'career_title');
  assert.equal(row.descriptionKey, 'career_desc');
  assert.equal(row.timeToComplete, '45');
  assert.equal(row.blueprintRewardPoolGuids, 'blueprint-pool');
  assert.equal(
    row.blueprintRewards,
    '[{"blueprintPool":"blueprint-pool","chance":1,"trigger":"","type":"BlueprintRewards"}]',
  );
});

test('extractDataCoreContractGenerators does not use XML string-hash fallback when graph variants are placeholders', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-contract-generator-variant-placeholder-'));
  const generatorPath = 'libs/foundry/records/contracts/contractgenerator/test_generator.xml';
  await fs.mkdir(path.dirname(path.join(xmlCacheDir, generatorPath)), { recursive: true });
  await fs.writeFile(
    path.join(xmlCacheDir, generatorPath),
    `
      <ContractGenerator.TestGenerator __type="ContractGenerator" __ref="generator-guid" __path="${generatorPath}">
        <generators>
          <ContractGeneratorHandler_Career debugName="Career_Handler">
            <introContracts>
              <Contract id="contract-guid" debugName="Intro_Contract" template="template-guid">
                <paramOverrides>
                  <propertyOverrides>
                    <MissionProperty missionVariableName="Mission_Title_StringHash">
                      <value>
                        <MissionPropertyValue_StringHash>
                          <options>
                            <MissionPropertyValueOption_StringHash textId="@intro_title_xml_fallback" weighting="1" />
                          </options>
                        </MissionPropertyValue_StringHash>
                      </value>
                    </MissionProperty>
                    <MissionProperty missionVariableName="Mission_Description_StringHash">
                      <value>
                        <MissionPropertyValue_StringHash>
                          <options>
                            <MissionPropertyValueOption_StringHash textId="@intro_desc_xml_fallback" weighting="1" />
                          </options>
                        </MissionPropertyValue_StringHash>
                      </value>
                    </MissionProperty>
                  </propertyOverrides>
                </paramOverrides>
              </Contract>
            </introContracts>
          </ContractGeneratorHandler_Career>
        </generators>
      </ContractGenerator.TestGenerator>
    `,
  );
  const graph = graphFixture(generatorPath);
  graph.records[0].localizationKeys = [
    { attribute: 'contract:contract-guid:Mission_Title_StringHash.textId', key: 'LOC_PLACEHOLDER' },
    { attribute: 'contract:contract-guid:Mission_Description_StringHash.textId', key: 'LOC_EMPTY' },
  ];

  const [row] = await extractDataCoreContractGenerators({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(graph),
  });

  assert.equal(row.titleVariantKeys, '');
  assert.equal(row.descriptionVariantKeys, '');
});

test('extractDataCoreContractGenerators does not use XML string-param fallback when graph params are placeholders', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-contract-generator-param-placeholder-'));
  const generatorPath = 'libs/foundry/records/contracts/contractgenerator/test_generator.xml';
  await fs.mkdir(path.dirname(path.join(xmlCacheDir, generatorPath)), { recursive: true });
  await fs.writeFile(
    path.join(xmlCacheDir, generatorPath),
    `
      <ContractGenerator.TestGenerator __type="ContractGenerator" __ref="generator-guid" __path="${generatorPath}">
        <generators>
          <ContractGeneratorHandler_Career debugName="Career_Handler">
            <contractParams>
              <stringParamOverrides>
                <ContractStringParam param="Contractor" value="@contractor_from_xml" />
              </stringParamOverrides>
            </contractParams>
            <introContracts>
              <Contract id="contract-guid" debugName="Intro_Contract" template="template-guid">
                <paramOverrides>
                  <stringParamOverrides>
                    <ContractStringParam param="Title" value="@intro_title_xml" />
                    <ContractStringParam param="Description" value="@intro_desc_xml" />
                  </stringParamOverrides>
                </paramOverrides>
              </Contract>
            </introContracts>
          </ContractGeneratorHandler_Career>
        </generators>
      </ContractGenerator.TestGenerator>
    `,
  );
  const graph = graphFixture(generatorPath);
  graph.records[0].localizationKeys = [
    { attribute: 'contract:contract-guid:ContractStringParam.Contractor', key: 'contractor_from_graph' },
    { attribute: 'contract:contract-guid:ContractStringParam.Description', key: 'LOC_EMPTY' },
    { attribute: 'contract:contract-guid:ContractStringParam.Title', key: 'LOC_PLACEHOLDER' },
  ];

  const [row] = await extractDataCoreContractGenerators({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(graph),
  });

  assert.equal(row.titleKey, '');
  assert.equal(row.descriptionKey, '');
  assert.equal(row.contractorKey, 'contractor_from_graph');
  assert.equal(row.stringParamOverrides, 'Contractor=contractor_from_graph | Description= | Title=');
});

function graphFixture(generatorPath: string, options: { ambiguousTemplate?: boolean } = {}): DataCoreRecordGraph {
  const templateReferences = options.ambiguousTemplate
    ? [
        { attribute: 'template', value: 'template-guid' },
        { attribute: 'template', value: 'other-template-guid' },
        { attribute: 'contract:career-contract-guid:template', value: 'template-guid' },
        { attribute: 'contract:career-contract-guid:template', value: 'other-template-guid' },
      ]
    : [
        { attribute: 'template', value: 'template-guid' },
        { attribute: 'contract:contract-guid:template', value: 'template-guid' },
      ];
  const referencedGuids = [
    ...templateReferences.map((reference) => reference.value),
    'location-guid',
    'difficulty-guid',
    'faction-guid',
    'scope-guid',
  ];

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
        localizationKeys: [
          { attribute: 'contract:contract-guid:ContractStringParam.Contractor', key: 'contractor_from' },
          { attribute: 'contract:contract-guid:ContractStringParam.Description', key: 'intro_desc' },
          { attribute: 'contract:contract-guid:ContractStringParam.Title', key: 'intro_title' },
          { attribute: 'contract:contract-guid:Mission_Title_StringHash.textId', key: 'intro_title_001' },
          { attribute: 'contract:contract-guid:Mission_Description_StringHash.textId', key: 'intro_desc_002' },
          { attribute: 'contract:contract-guid:Mission_Description_StringHash.textId', key: 'LOC_PLACEHOLDER' },
          { attribute: 'contract:contract-guid:Mission_Description_StringHash.textId', key: 'intro_desc_001' },
        ],
        referencedGuids,
        referencedGuidAttributes: [
          ...templateReferences,
          { attribute: 'contract:contract-guid:MissionLocation.Reference.value', value: 'location-guid' },
          { attribute: 'difficultyProfile', value: 'difficulty-guid' },
          { attribute: 'factionReputation', value: 'faction-guid' },
          { attribute: 'reputationScope', value: 'scope-guid' },
        ],
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
