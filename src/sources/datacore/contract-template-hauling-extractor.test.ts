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
                  <HaulingOrder_Resource resource="resource-guid" minSCU="12" maxSCU="87" maxContainerSize="8" />
                </haulingOrders>
              </ObjectiveHandler_Hauling>
            </objectiveHandler>
          </ObjectiveToken>
        </objectiveTokens>
      </ContractTemplate.HaulTest>
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
        minSCU: '12',
        maxSCU: '87',
        maxContainerSize: '8',
        orderSummary: '12-87 SCU Carbon, max 8 SCU',
        recordGuid: 'template-guid',
        recordPath: templatePath,
      },
    ],
  );
});

function graphFixture(templatePath: string): DataCoreRecordGraph {
  return {
    source: 'datacore-record-graph',
    recordCount: 2,
    records: [
      {
        path: templatePath,
        ref: 'template-guid',
        rootTag: 'ContractTemplate.HaulTest',
        rootType: 'ContractTemplate',
        entityClass: 'HaulTest',
        localizationKeys: [],
        referencedGuids: [],
      },
      {
        path: 'carbon.xml',
        ref: 'resource-guid',
        rootTag: 'EntityClassDefinition.Carbon',
        rootType: 'EntityClassDefinition',
        entityClass: 'Carbon',
        localizationKeys: [],
        referencedGuids: [],
      },
    ],
    indexes: {
      byRef: {
        'template-guid': templatePath,
        'resource-guid': 'carbon.xml',
      },
      byPath: {},
      byRootType: {},
      byEntityClass: {},
      byLocalizationKey: {},
      byReferencedGuid: {},
    },
  };
}
