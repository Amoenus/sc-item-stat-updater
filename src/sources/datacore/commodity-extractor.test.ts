import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreCommodities } from './commodity-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

const atlasiumPath = 'libs/foundry/records/entities/commodities/alloys/atlasium.xml';
const rantadungPath = 'libs/foundry/records/entities/commodities/agriculturalsupplies/rantadung.xml';
const notCommodityPath = 'libs/foundry/records/entities/commodities/readme.xml';
const carinitePurePath = 'libs/foundry/records/entities/scitem/carryables/1h/harvestable_mineral_1h_carinitepure.xml';
const armillariaPath = 'libs/foundry/records/entities/scitem/carryables/1h/harvestable_armillaria.xml';
const armillariaBasePath = 'libs/foundry/records/entities/scitem/harvestables/bases/harvestable_base_armillaria.xml';

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
  await writeXml(
    xmlCacheDir,
    carinitePurePath,
    `
      <EntityClassDefinition.Harvestable_Mineral_1H_CarinitePure __type="EntityClassDefinition" __ref="9904aaa2-9a13-48d2-a48d-7494e60d012f" __path="${carinitePurePath}">
        <Components>
          <SAttachableComponentParams>
            <AttachDef>
              <Localization Name="@items_commodities_carinite_pure" ShortName="@items_commodities_carinite_pure" Description="@items_commodities_carinite_pure_desc" />
            </AttachDef>
          </SAttachableComponentParams>
        </Components>
      </EntityClassDefinition.Harvestable_Mineral_1H_CarinitePure>
    `,
  );
  await writeXml(
    xmlCacheDir,
    armillariaPath,
    `
      <EntityClassDefinition.Harvestable_Armillaria __type="EntityClassDefinition" __ref="0ece223a-df2b-4c7a-82e1-7f1467f9c5a1" __path="${armillariaPath}">
        <Components>
          <SAttachableComponentParams>
            <AttachDef>
              <Localization Name="@harvestable_Armillaria" Description="@harvestable_Armillaria_desc" />
            </AttachDef>
          </SAttachableComponentParams>
        </Components>
      </EntityClassDefinition.Harvestable_Armillaria>
    `,
  );
  await writeXml(
    xmlCacheDir,
    armillariaBasePath,
    `
      <EntityClassDefinition.harvestable_base_Armillaria __type="EntityClassDefinition" __ref="ac659f18-1681-4406-8eff-4bd9173b94a7" __path="${armillariaBasePath}">
        <Components>
          <SAttachableComponentParams>
            <AttachDef>
              <Localization Name="@harvestable_Armillaria" Description="@harvestable_Armillaria_desc" />
            </AttachDef>
          </SAttachableComponentParams>
        </Components>
      </EntityClassDefinition.harvestable_base_Armillaria>
    `,
  );

  const rows = await extractDataCoreCommodities({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph()),
  });

  assert.equal(rows.length, 4);
  assert.deepEqual(
    rows.map((row) => row.path),
    [rantadungPath, atlasiumPath, carinitePurePath, armillariaBasePath],
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

  const carinitePure = rows.find((row) => row.entityClass === 'Harvestable_Mineral_1H_CarinitePure');
  assert.ok(carinitePure);
  assert.equal(carinitePure.nameKey, 'items_commodities_carinite_pure');
  assert.equal(carinitePure.descriptionKey, 'items_commodities_carinite_pure_desc');
  assert.equal(carinitePure.displayNameKey, 'items_commodities_carinite_pure');
  assert.equal(carinitePure.displayDescriptionKey, 'items_commodities_carinite_pure_desc');
  assert.equal(carinitePure.typeGuid, '');

  const armillaria = rows.find((row) => row.entityClass === 'harvestable_base_Armillaria');
  assert.ok(armillaria);
  assert.equal(armillaria.nameKey, 'harvestable_Armillaria');
  assert.equal(armillaria.descriptionKey, 'harvestable_Armillaria_desc');
  assert.equal(armillaria.displayNameKey, 'harvestable_Armillaria');
  assert.equal(armillaria.displayDescriptionKey, 'harvestable_Armillaria_desc');
  assert.equal(armillaria.typeGuid, '');
});

async function writeXml(xmlCacheDir: string, recordPath: string, xml: string): Promise<void> {
  const xmlPath = path.join(xmlCacheDir, recordPath);
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(xmlPath, xml, 'utf8');
}

function makeGraph(): DataCoreRecordGraph {
  return {
    source: 'datacore-record-graph',
    recordCount: 6,
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
      {
        path: carinitePurePath,
        ref: '9904aaa2-9a13-48d2-a48d-7494e60d012f',
        rootTag: 'EntityClassDefinition.Harvestable_Mineral_1H_CarinitePure',
        rootType: 'EntityClassDefinition',
        entityClass: 'Harvestable_Mineral_1H_CarinitePure',
        localizationKeys: [
          { attribute: 'displayName', key: 'items_commodities_carinite' },
          { attribute: 'displayType', key: 'items_commodities_carinite_desc' },
          { attribute: 'Name', key: 'items_commodities_carinite_pure' },
          { attribute: 'Description', key: 'items_commodities_carinite_pure_desc' },
        ],
        referencedGuids: [],
      },
      {
        path: armillariaPath,
        ref: '0ece223a-df2b-4c7a-82e1-7f1467f9c5a1',
        rootTag: 'EntityClassDefinition.Harvestable_Armillaria',
        rootType: 'EntityClassDefinition',
        entityClass: 'Harvestable_Armillaria',
        localizationKeys: [
          { attribute: 'Name', key: 'harvestable_Armillaria' },
          { attribute: 'Description', key: 'harvestable_Armillaria_desc' },
        ],
        referencedGuids: [],
      },
      {
        path: armillariaBasePath,
        ref: 'ac659f18-1681-4406-8eff-4bd9173b94a7',
        rootTag: 'EntityClassDefinition.harvestable_base_Armillaria',
        rootType: 'EntityClassDefinition',
        entityClass: 'harvestable_base_Armillaria',
        localizationKeys: [
          { attribute: 'Name', key: 'harvestable_Armillaria' },
          { attribute: 'Description', key: 'harvestable_Armillaria_desc' },
        ],
        referencedGuids: [],
      },
    ],
    indexes: {
      byRef: {
        'af5dcf22-7a28-4b1e-88f0-4309d34be11a': atlasiumPath,
        '86c1fde0-1e2b-40d9-a3c7-1d39ef742c68': rantadungPath,
        '11111111-1111-1111-1111-111111111111': notCommodityPath,
        '9904aaa2-9a13-48d2-a48d-7494e60d012f': carinitePurePath,
        '0ece223a-df2b-4c7a-82e1-7f1467f9c5a1': armillariaPath,
        'ac659f18-1681-4406-8eff-4bd9173b94a7': armillariaBasePath,
      },
      byPath: {
        [atlasiumPath]: 0,
        [rantadungPath]: 1,
        [notCommodityPath]: 2,
        [carinitePurePath]: 3,
        [armillariaPath]: 4,
        [armillariaBasePath]: 5,
      },
      byRootType: {
        EntityClassDefinition: [
          atlasiumPath,
          rantadungPath,
          notCommodityPath,
          carinitePurePath,
          armillariaPath,
          armillariaBasePath,
        ],
      },
      byEntityClass: {
        atlasium: [atlasiumPath],
        RantaDung: [rantadungPath],
        NotActuallyCommodity: [notCommodityPath],
        Harvestable_Mineral_1H_CarinitePure: [carinitePurePath],
        Harvestable_Armillaria: [armillariaPath],
        harvestable_base_Armillaria: [armillariaBasePath],
      },
      byLocalizationKey: {},
      byReferencedGuid: {},
    },
  };
}
