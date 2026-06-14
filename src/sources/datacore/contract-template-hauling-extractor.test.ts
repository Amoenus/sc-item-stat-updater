import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreContractTemplateHaulingOrders } from './contract-template-hauling-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

test('extractDataCoreContractTemplateHaulingOrders emits hauling resource order facts', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-template-hauling-'));
  const templatePath = 'libs/foundry/records/contracts/contracttemplates/haul_test.xml';
  await fs.mkdir(path.dirname(path.join(xmlCacheDir, templatePath)), { recursive: true });
  await fs.writeFile(
    path.join(xmlCacheDir, templatePath),
    `
      <ContractTemplate.HaulTest __type="ContractTemplate" __ref="template-guid" __path="${templatePath}">
        <objectiveTokens>
          <ObjectiveToken debugName="Hauling">
            <objectiveHandler>
              <ObjectiveHandler_Hauling>
                <haulingOrders>
                  <HaulingOrder_Resource resource="resource-xml-fallback-guid" minSCU="12" maxSCU="87" maxContainerSize="8" />
                  <HaulingOrder_Resource resource="fallback-resource-guid" minSCU="1" maxSCU="1" maxContainerSize="1" />
                </haulingOrders>
              </ObjectiveHandler_Hauling>
            </objectiveHandler>
          </ObjectiveToken>
        </objectiveTokens>
      </ContractTemplate.HaulTest>
    `,
  );
  const carryablePath = 'libs/foundry/records/entities/scitem/carryables/carryable_carbon.xml';
  await fs.mkdir(path.dirname(path.join(xmlCacheDir, carryablePath)), { recursive: true });
  await fs.writeFile(
    path.join(xmlCacheDir, carryablePath),
    `
      <EntityClassDefinition.CarryableCarbon __type="EntityClassDefinition" __ref="carryable-guid" __path="${carryablePath}">
        <SAttachableComponentParams>
          <AttachDef>
            <Localization Name="@items_commodities_carbon_stale" />
          </AttachDef>
        </SAttachableComponentParams>
        <ResourceContainer>
          <defaultComposition>
            <ResourceContainerDefaultCompositionEntry entry="resource-guid" weight="1" />
            <ResourceContainerDefaultCompositionEntry entry="fallback-resource-guid" weight="1" />
          </defaultComposition>
        </ResourceContainer>
      </EntityClassDefinition.CarryableCarbon>
    `,
  );

  assert.deepEqual(
    await extractDataCoreContractTemplateHaulingOrders({
      xmlCacheDir,
      graph: createDataCoreRecordGraphLookup(graphFixture(templatePath)),
    }),
    [
      {
        templateClass: 'HaulTest',
        objectiveDebugName: 'Hauling',
        orderIndex: '1',
        resourceGuid: 'resource-guid',
        resourceClass: 'Carbon',
        resourceNameKey: 'items_commodities_carbon',
        minSCU: '12',
        maxSCU: '87',
        maxContainerSize: '8',
        orderSummary: '',
        recordGuid: 'template-guid',
        recordPath: templatePath,
      },
      {
        templateClass: 'HaulTest',
        objectiveDebugName: 'Hauling',
        orderIndex: '2',
        resourceGuid: 'fallback-resource-guid',
        resourceClass: 'CarryableCarbon',
        resourceNameKey: 'items_commodities_carbon',
        minSCU: '1',
        maxSCU: '1',
        maxContainerSize: '1',
        orderSummary: '',
        recordGuid: 'template-guid',
        recordPath: templatePath,
      },
    ],
  );
});

test('extractDataCoreContractTemplateHaulingOrders prefers unique graph refs for resources', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-template-hauling-refs-'));
  const templatePath = 'libs/foundry/records/contracts/contracttemplates/haul_graph.xml';
  await fs.mkdir(path.dirname(path.join(xmlCacheDir, templatePath)), { recursive: true });
  await fs.writeFile(
    path.join(xmlCacheDir, templatePath),
    `
      <ContractTemplate.HaulGraph __type="ContractTemplate" __ref="template-guid" __path="${templatePath}">
        <objectiveTokens>
          <ObjectiveToken debugName="Hauling">
            <objectiveHandler>
              <ObjectiveHandler_Hauling>
                <haulingOrders>
                  <HaulingOrder_Resource resource="stale-resource-guid" minSCU="2" maxSCU="4" maxContainerSize="8" />
                </haulingOrders>
              </ObjectiveHandler_Hauling>
            </objectiveHandler>
          </ObjectiveToken>
        </objectiveTokens>
      </ContractTemplate.HaulGraph>
    `,
  );
  const carryablePath = 'libs/foundry/records/entities/scitem/carryables/carryable_carbon.xml';
  await fs.mkdir(path.dirname(path.join(xmlCacheDir, carryablePath)), { recursive: true });
  await fs.writeFile(
    path.join(xmlCacheDir, carryablePath),
    `
      <EntityClassDefinition.CarryableCarbon __type="EntityClassDefinition" __ref="carryable-guid" __path="${carryablePath}">
        <ResourceContainer>
          <defaultComposition>
            <ResourceContainerDefaultCompositionEntry entry="stale-resource-guid" weight="1" />
          </defaultComposition>
        </ResourceContainer>
      </EntityClassDefinition.CarryableCarbon>
    `,
  );
  const graph = graphFixture(templatePath);
  graph.records[0].referencedGuids = ['resource-guid'];
  graph.records[0].referencedGuidAttributes = [
    { attribute: 'template:HaulingOrder_Resource:1.resource', value: 'resource-guid' },
  ];
  graph.records[2].referencedGuids = ['resource-guid'];
  graph.records[2].referencedGuidAttributes = [{ attribute: 'entry', value: 'resource-guid' }];

  assert.deepEqual(
    await extractDataCoreContractTemplateHaulingOrders({
      xmlCacheDir,
      graph: createDataCoreRecordGraphLookup(graph),
    }),
    [
      {
        templateClass: 'HaulGraph',
        objectiveDebugName: 'Hauling',
        orderIndex: '1',
        resourceGuid: 'resource-guid',
        resourceClass: 'Carbon',
        resourceNameKey: 'items_commodities_carbon',
        minSCU: '2',
        maxSCU: '4',
        maxContainerSize: '8',
        orderSummary: '',
        recordGuid: 'template-guid',
        recordPath: templatePath,
      },
    ],
  );
});

test('extractDataCoreContractTemplateHaulingOrders does not use XML fallback when graph resource refs are ambiguous', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-template-hauling-ambiguous-'));
  const templatePath = 'libs/foundry/records/contracts/contracttemplates/haul_ambiguous.xml';
  await fs.mkdir(path.dirname(path.join(xmlCacheDir, templatePath)), { recursive: true });
  await fs.writeFile(
    path.join(xmlCacheDir, templatePath),
    `
      <ContractTemplate.HaulGraph __type="ContractTemplate" __ref="template-guid" __path="${templatePath}">
        <objectiveTokens>
          <ObjectiveToken debugName="Hauling">
            <objectiveHandler>
              <ObjectiveHandler_Hauling>
                <haulingOrders>
                  <HaulingOrder_Resource resource="stale-resource-guid" minSCU="2" maxSCU="4" maxContainerSize="8" />
                </haulingOrders>
              </ObjectiveHandler_Hauling>
            </objectiveHandler>
          </ObjectiveToken>
        </objectiveTokens>
      </ContractTemplate.HaulGraph>
    `,
  );
  const graph = graphFixture(templatePath);
  graph.records[0].referencedGuids = ['resource-guid', 'other-resource-guid'];
  graph.records[0].referencedGuidAttributes = [
    { attribute: 'template:HaulingOrder_Resource:1.resource', value: 'resource-guid' },
    { attribute: 'template:HaulingOrder_Resource:1.resource', value: 'other-resource-guid' },
  ];

  const [row] = await extractDataCoreContractTemplateHaulingOrders({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(graph),
    carryablePathPrefix: 'no/carryables',
  });

  assert.equal(row.resourceGuid, '');
  assert.equal(row.resourceClass, '');
  assert.equal(row.resourceNameKey, '');
});

function graphFixture(templatePath: string): DataCoreRecordGraph {
  const templateClass = templatePath.includes('haul_graph') ? 'HaulGraph' : 'HaulTest';
  return {
    source: 'datacore-record-graph',
    recordCount: 3,
    records: [
      {
        path: templatePath,
        ref: 'template-guid',
        rootTag: `ContractTemplate.${templateClass}`,
        rootType: 'ContractTemplate',
        entityClass: templateClass,
        localizationKeys: [],
        referencedGuids: ['resource-guid', 'fallback-resource-guid'],
        referencedGuidAttributes: [
          { attribute: 'template:HaulingOrder_Resource:1.resource', value: 'resource-guid' },
          { attribute: 'template:HaulingOrder_Resource:2.resource', value: 'fallback-resource-guid' },
        ],
      },
      {
        path: 'unresolved-resource.xml',
        ref: 'resource-guid',
        rootTag: 'EntityClassDefinition.Carbon',
        rootType: 'EntityClassDefinition',
        entityClass: 'Carbon',
        localizationKeys: [],
        referencedGuids: [],
      },
      {
        path: 'libs/foundry/records/entities/scitem/carryables/carryable_carbon.xml',
        ref: 'carryable-guid',
        rootTag: 'EntityClassDefinition.CarryableCarbon',
        rootType: 'EntityClassDefinition',
        entityClass: 'CarryableCarbon',
        localizationKeys: [
          { attribute: 'Name', key: 'LOC_PLACEHOLDER' },
          { attribute: 'displayName', key: 'items_commodities_carbon' },
        ],
        referencedGuids: [],
      },
    ],
    indexes: {
      byRef: {
        'template-guid': templatePath,
        'resource-guid': 'unresolved-resource.xml',
        'carryable-guid': 'libs/foundry/records/entities/scitem/carryables/carryable_carbon.xml',
      },
      byPath: {},
      byRootType: {},
      byEntityClass: {},
      byLocalizationKey: {},
      byReferencedGuid: {},
    },
  };
}
