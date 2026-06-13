import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreMaterialLocalizations } from './material-localization-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

test('extractDataCoreMaterialLocalizations prefers graph localization keys for resource entries', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-material-localizations-'));
  const carryablePath = 'libs/foundry/records/entities/scitem/carryables/carryable_titanium.xml';
  await fs.mkdir(path.dirname(path.join(xmlCacheDir, carryablePath)), { recursive: true });
  await fs.writeFile(
    path.join(xmlCacheDir, carryablePath),
    `
      <EntityClassDefinition.CarryableTitanium __type="EntityClassDefinition" __ref="carryable-guid" __path="${carryablePath}">
        <SAttachableComponentParams>
          <AttachDef>
            <Localization Name="@items_commodities_titanium_stale" />
          </AttachDef>
        </SAttachableComponentParams>
        <ResourceContainer>
          <defaultComposition>
            <ResourceContainerDefaultCompositionEntry entry="stale-resource-guid" weight="1" />
          </defaultComposition>
        </ResourceContainer>
      </EntityClassDefinition.CarryableTitanium>
    `,
    'utf8',
  );

  assert.deepEqual(
    await extractDataCoreMaterialLocalizations({
      xmlCacheDir,
      graph: createDataCoreRecordGraphLookup(graphFixture(carryablePath)),
    }),
    [{ resourceGuid: 'resource-guid', localizationKey: 'items_commodities_titanium' }],
  );
});

function graphFixture(carryablePath: string): DataCoreRecordGraph {
  return {
    source: 'datacore-record-graph',
    recordCount: 1,
    records: [
      {
        path: carryablePath,
        ref: 'carryable-guid',
        rootTag: 'EntityClassDefinition.CarryableTitanium',
        rootType: 'EntityClassDefinition',
        entityClass: 'CarryableTitanium',
        localizationKeys: [
          { attribute: 'Name', key: 'LOC_PLACEHOLDER' },
          { attribute: 'displayName', key: 'items_commodities_titanium' },
        ],
        referencedGuids: ['resource-guid'],
        referencedGuidAttributes: [{ attribute: 'entry', value: 'resource-guid' }],
      },
    ],
    indexes: {
      byRef: { 'carryable-guid': carryablePath },
      byPath: { [carryablePath]: 0 },
      byRootType: { EntityClassDefinition: [carryablePath] },
      byEntityClass: { CarryableTitanium: [carryablePath] },
      byLocalizationKey: { items_commodities_titanium: [carryablePath] },
      byReferencedGuid: {},
    },
  };
}
