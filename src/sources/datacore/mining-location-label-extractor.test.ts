import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreMiningLocationLabels } from './mining-location-label-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph, DataCoreRecordNode } from './types';

const miningLocationPath = 'libs/foundry/records/starmap/pu/asteroidcluster_miningbase_pyro_regiona_medium_01.xml';
const pyroSystemPath = 'libs/foundry/records/starmap/pu/pyrosolarsystem.xml';
const parentPath = 'libs/foundry/records/starmap/pu/pyroasteroidbelt.xml';
const qualityOverridePath =
  'libs/foundry/records/crafting/qualitydistribution/fpsmineables/fpsmineable_qualitydistribution_pyro.xml';

test('extractDataCoreMiningLocationLabels extracts mining StarMap labels and quality-referenced locations', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-mining-location-labels-'));
  await writeXml(
    xmlCacheDir,
    miningLocationPath,
    `
      <StarMapObject.AsteroidCluster_MiningBase_Pyro_RegionA_Medium_01 name="@ab_mine_pyro_regiona_med_001_stale" description="@ab_mine_pyro_stale_desc" callout1="@ab_mine_pyro_stale_callout1" callout2="@ab_mine_pyro_stale_callout2" type="stale-type-guid" parent="stale-parent-guid" locationHierarchyTag="812520ca-5f0a-4e88-9649-91237b1e4e51" navIcon="Default" size="400" hideInStarmap="0" hideInWorld="0" isScannable="0" blockTravel="0" __type="StarMapObject" __ref="544034db-6fde-44b4-aba8-c2ea35421ccd" __path="${miningLocationPath}">
        <quantumTravelData>
          <StarMapQuantumTravelDataParams arrivalRadius="18000" adoptionRadius="20000" />
        </quantumTravelData>
        <locationParams>
          <StarMapObjectLocationParams setEntityLocationOnEnter="1" exposeForPlayerCreatedMissions="0" />
        </locationParams>
      </StarMapObject.AsteroidCluster_MiningBase_Pyro_RegionA_Medium_01>
    `,
  );
  await writeXml(
    xmlCacheDir,
    pyroSystemPath,
    `
      <StarMapObject.PyroSolarSystem name="@PyroSystem_Stale" description="@PyroSystem_Desc" type="32ed44de-920b-43ce-b55d-82cc4ef9fa59" navIcon="Default" size="0.1" hideInStarmap="1" hideInWorld="1" isScannable="0" blockTravel="1" __type="StarMapObject" __ref="286cb603-b4ae-4279-80a1-d4505fee1916" __path="${pyroSystemPath}">
        <locationParams>
          <StarMapObjectLocationParams setEntityLocationOnEnter="0" exposeForPlayerCreatedMissions="1" />
        </locationParams>
      </StarMapObject.PyroSolarSystem>
    `,
  );
  await writeXml(
    xmlCacheDir,
    qualityOverridePath,
    `
      <CraftingQualityLocationOverrideRecord.FPSMineable_QualityDistribution_Pyro __type="CraftingQualityLocationOverrideRecord" __ref="d4574707-cc74-423b-b098-d061bd500d39" __path="${qualityOverridePath}">
        <locationOverride>
          <CraftingQualityLocationOverride>
            <locationOverrideList>
              <CraftingQualityLocationOverrideEntry location="stale-location-guid" />
            </locationOverrideList>
          </CraftingQualityLocationOverride>
        </locationOverride>
      </CraftingQualityLocationOverrideRecord.FPSMineable_QualityDistribution_Pyro>
    `,
  );

  const rows = await extractDataCoreMiningLocationLabels({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph()),
  });

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    ref: '544034db-6fde-44b4-aba8-c2ea35421ccd',
    path: miningLocationPath,
    locationClass: 'AsteroidCluster_MiningBase_Pyro_RegionA_Medium_01',
    sourceReason: 'class-or-path-mining',
    nameKey: 'ab_mine_pyro_regiona_med_001',
    descriptionKey: 'ab_mine_pyro_desc',
    callout1Key: '',
    callout2Key: 'ab_mine_pyro_callout2',
    callout3Key: '',
    typeGuid: '',
    parentGuid: 'a14bec87-5801-4440-8ca8-35597487ac9a',
    parentClass: 'PyroAsteroidBelt',
    parentPath,
    locationHierarchyTag: '812520ca-5f0a-4e88-9649-91237b1e4e51',
    navIcon: 'Default',
    size: '400',
    hideInStarmap: '0',
    hideInWorld: '0',
    isScannable: '0',
    blockTravel: '0',
    arrivalRadius: '18000',
    adoptionRadius: '20000',
    setEntityLocationOnEnter: '1',
    exposeForPlayerCreatedMissions: '0',
  });
  assert.equal(rows[1].locationClass, 'PyroSolarSystem');
  assert.equal(rows[1].sourceReason, 'mining-quality-location');
  assert.equal(rows[1].nameKey, 'PyroSystem');
});

async function writeXml(xmlCacheDir: string, recordPath: string, xml: string): Promise<void> {
  const xmlPath = path.join(xmlCacheDir, recordPath);
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(xmlPath, xml, 'utf8');
}

function makeGraph(): DataCoreRecordGraph {
  const records: DataCoreRecordNode[] = [
    node(
      miningLocationPath,
      '544034db-6fde-44b4-aba8-c2ea35421ccd',
      'StarMapObject',
      'AsteroidCluster_MiningBase_Pyro_RegionA_Medium_01',
      [
        { attribute: 'name', key: 'LOC_PLACEHOLDER' },
        { attribute: 'displayName', key: 'ab_mine_pyro_regiona_med_001' },
        { attribute: 'description', key: 'LOC_PLACEHOLDER' },
        { attribute: 'displayDescription', key: 'ab_mine_pyro_desc' },
        { attribute: 'callout1', key: 'LOC_PLACEHOLDER' },
        { attribute: 'callout2', key: 'ab_mine_pyro_callout2' },
      ],
      [
        { attribute: 'parent', value: '' },
        { attribute: 'parent', value: 'a14bec87-5801-4440-8ca8-35597487ac9a' },
        { attribute: 'type', value: '' },
        { attribute: 'type', value: 'e60452a5-b85c-4ab1-97e7-9cefb466f87b' },
        { attribute: 'type', value: '4e23177a-79e4-42d4-938c-c36c65b0b129' },
      ],
    ),
    node(pyroSystemPath, '286cb603-b4ae-4279-80a1-d4505fee1916', 'StarMapObject', 'PyroSolarSystem', [
      { attribute: 'name', key: 'PyroSystem' },
    ]),
    node(parentPath, 'a14bec87-5801-4440-8ca8-35597487ac9a', 'StarMapObject', 'PyroAsteroidBelt'),
    node(
      qualityOverridePath,
      'd4574707-cc74-423b-b098-d061bd500d39',
      'CraftingQualityLocationOverrideRecord',
      'FPSMineable_QualityDistribution_Pyro',
      [],
      [{ attribute: 'location', value: '286cb603-b4ae-4279-80a1-d4505fee1916' }],
    ),
  ];

  return {
    source: 'datacore-record-graph',
    recordCount: records.length,
    records,
    indexes: {
      byRef: Object.fromEntries(records.map((record) => [record.ref, record.path])),
      byPath: Object.fromEntries(records.map((record, index) => [record.path, index])),
      byRootType: {
        StarMapObject: [miningLocationPath, pyroSystemPath, parentPath],
        CraftingQualityLocationOverrideRecord: [qualityOverridePath],
      },
      byEntityClass: {},
      byLocalizationKey: {},
      byReferencedGuid: {},
    },
  };
}

function node(
  pathValue: string,
  ref: string,
  rootType: string,
  entityClass: string,
  localizationKeys: DataCoreRecordNode['localizationKeys'] = [],
  referencedGuidAttributes: NonNullable<DataCoreRecordNode['referencedGuidAttributes']> = [],
): DataCoreRecordNode {
  return {
    path: pathValue,
    ref,
    rootTag: `${rootType}.${entityClass}`,
    rootType,
    entityClass,
    localizationKeys,
    referencedGuids: referencedGuidAttributes.map((reference) => reference.value),
    referencedGuidAttributes,
  };
}
