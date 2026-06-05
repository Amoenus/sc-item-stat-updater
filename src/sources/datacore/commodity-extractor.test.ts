import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import { extractDataCoreCommodities } from './commodity-extractor';
import type { DataCoreRecordGraph } from './types';

const atlasiumPath = 'libs/foundry/records/entities/commodities/alloys/atlasium.xml';
const rantadungPath = 'libs/foundry/records/entities/commodities/agriculturalsupplies/rantadung.xml';
const notCommodityPath = 'libs/foundry/records/entities/commodities/readme.xml';

test('extractDataCoreCommodities extracts first-party commodity facts discovered through the graph', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-commodities-'));
  await writeXml(
    xmlCacheDir,
    atlasiumPath,
    `
      <EntityClassDefinition.atlasium __type="EntityClassDefinition" __ref="af5dcf22-7a28-4b1e-88f0-4309d34be11a" __path="${atlasiumPath}">
        <StaticEntityClassData>
          <EntityUIDisplayParams displayName="@LOC_UNINITIALIZED" displayDescription="@items_commodities_atlasium_desc" />
        </StaticEntityClassData>
        <Components>
          <CommodityComponentParams type="22325f28-8d37-46ab-8c08-8a9b34101fad" subtype="45f89d34-3167-4723-9b85-f9df3770ce00" name="@items_commodities_atlasium" description="@items_commodities_atlasium_desc" IsUnrefinedElement="0" boxable="1">
            <occupancy>
              <SCentiCargoUnit centiSCU="1" />
            </occupancy>
          </CommodityComponentParams>
          <SCItemPurchasableParams displayName="@items_commodities_atlasium" displayType="@items_commodities_type_alloy" />
        </Components>
      </EntityClassDefinition.atlasium>
    `,
  );
  await writeXml(
    xmlCacheDir,
    rantadungPath,
    `
      <EntityClassDefinition.RantaDung __type="EntityClassDefinition" __ref="86c1fde0-1e2b-40d9-a3c7-1d39ef742c68" __path="${rantadungPath}">
        <StaticEntityClassData>
          <EntityUIDisplayParams displayDescription="@items_commodities_rantadung_desc" />
        </StaticEntityClassData>
        <Components>
          <SCItemPurchasableParams displayName="@items_commodities_rantadung" displayType="@items_commodities_type_agriculturalSupply" />
          <CommodityComponentParams type="6bc39eae-ef95-4c6a-a883-7118aeef631e" subtype="8740c6c1-63cf-480f-af47-d2addf01fb31" name="@items_commodities_rantadung" description="@items_commodities_rantadung_desc" IsUnrefinedElement="1" boxable="0" isRaw="1">
            <occupancy>
              <SMicroCargoUnit microSCU="700" />
            </occupancy>
          </CommodityComponentParams>
        </Components>
      </EntityClassDefinition.RantaDung>
    `,
  );
  await writeXml(
    xmlCacheDir,
    notCommodityPath,
    `
      <EntityClassDefinition.NotActuallyCommodity __type="EntityClassDefinition" __ref="11111111-1111-1111-1111-111111111111" __path="${notCommodityPath}">
        <Components />
      </EntityClassDefinition.NotActuallyCommodity>
    `,
  );

  const rows = await extractDataCoreCommodities({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph()),
  });

  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => row.path),
    [rantadungPath, atlasiumPath],
  );

  const atlasium = rows.find((row) => row.entityClass === 'atlasium');
  assert.ok(atlasium);
  assert.equal(atlasium.nameKey, 'items_commodities_atlasium');
  assert.equal(atlasium.descriptionKey, 'items_commodities_atlasium_desc');
  assert.equal(atlasium.displayNameKey, 'items_commodities_atlasium');
  assert.equal(atlasium.displayDescriptionKey, 'items_commodities_atlasium_desc');
  assert.equal(atlasium.displayTypeKey, 'items_commodities_type_alloy');
  assert.equal(atlasium.typeGuid, '22325f28-8d37-46ab-8c08-8a9b34101fad');
  assert.equal(atlasium.subtypeGuid, '45f89d34-3167-4723-9b85-f9df3770ce00');
  assert.equal(atlasium.cargoOccupancyUnit, 'SCentiCargoUnit');
  assert.equal(atlasium.cargoOccupancyValue, '1');
  assert.equal(atlasium.cargoOccupancySCU, '0.01');
  assert.equal(atlasium.boxable, '1');
  assert.equal(atlasium.isUnrefinedElement, '0');
  assert.equal(atlasium.isRaw, '');
  assert.equal(atlasium.isRefined, '');

  const rantadung = rows.find((row) => row.entityClass === 'RantaDung');
  assert.ok(rantadung);
  assert.equal(rantadung.displayTypeKey, 'items_commodities_type_agriculturalSupply');
  assert.equal(rantadung.cargoOccupancyUnit, 'SMicroCargoUnit');
  assert.equal(rantadung.cargoOccupancyValue, '700');
  assert.equal(rantadung.cargoOccupancySCU, '0.0007');
  assert.equal(rantadung.boxable, '0');
  assert.equal(rantadung.isUnrefinedElement, '1');
  assert.equal(rantadung.isRaw, '1');
});

async function writeXml(xmlCacheDir: string, recordPath: string, xml: string): Promise<void> {
  const xmlPath = path.join(xmlCacheDir, recordPath);
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(xmlPath, xml, 'utf8');
}

function makeGraph(): DataCoreRecordGraph {
  return {
    source: 'datacore-record-graph',
    recordCount: 3,
    records: [
      {
        path: atlasiumPath,
        ref: 'af5dcf22-7a28-4b1e-88f0-4309d34be11a',
        rootTag: 'EntityClassDefinition.atlasium',
        rootType: 'EntityClassDefinition',
        entityClass: 'atlasium',
        localizationKeys: [
          { attribute: 'description', key: 'items_commodities_atlasium_desc' },
          { attribute: 'displayDescription', key: 'items_commodities_atlasium_desc' },
          { attribute: 'displayName', key: 'items_commodities_atlasium' },
          { attribute: 'displayType', key: 'items_commodities_type_alloy' },
          { attribute: 'name', key: 'items_commodities_atlasium' },
        ],
        referencedGuids: [],
      },
      {
        path: rantadungPath,
        ref: '86c1fde0-1e2b-40d9-a3c7-1d39ef742c68',
        rootTag: 'EntityClassDefinition.RantaDung',
        rootType: 'EntityClassDefinition',
        entityClass: 'RantaDung',
        localizationKeys: [
          { attribute: 'description', key: 'items_commodities_rantadung_desc' },
          { attribute: 'displayDescription', key: 'items_commodities_rantadung_desc' },
          { attribute: 'displayName', key: 'items_commodities_rantadung' },
          { attribute: 'displayType', key: 'items_commodities_type_agriculturalSupply' },
          { attribute: 'name', key: 'items_commodities_rantadung' },
        ],
        referencedGuids: [],
      },
      {
        path: notCommodityPath,
        ref: '11111111-1111-1111-1111-111111111111',
        rootTag: 'EntityClassDefinition.NotActuallyCommodity',
        rootType: 'EntityClassDefinition',
        entityClass: 'NotActuallyCommodity',
        localizationKeys: [],
        referencedGuids: [],
      },
    ],
    indexes: {
      byRef: {
        'af5dcf22-7a28-4b1e-88f0-4309d34be11a': atlasiumPath,
        '86c1fde0-1e2b-40d9-a3c7-1d39ef742c68': rantadungPath,
        '11111111-1111-1111-1111-111111111111': notCommodityPath,
      },
      byPath: {
        [atlasiumPath]: 0,
        [rantadungPath]: 1,
        [notCommodityPath]: 2,
      },
      byRootType: {
        EntityClassDefinition: [atlasiumPath, rantadungPath, notCommodityPath],
      },
      byEntityClass: {
        atlasium: [atlasiumPath],
        RantaDung: [rantadungPath],
        NotActuallyCommodity: [notCommodityPath],
      },
      byLocalizationKey: {},
      byReferencedGuid: {},
    },
  };
}
