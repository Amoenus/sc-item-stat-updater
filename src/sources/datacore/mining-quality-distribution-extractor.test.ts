import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreMiningQualityDistributions } from './mining-quality-distribution-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph, DataCoreRecordNode } from './types';

const defaultPath =
  'libs/foundry/records/crafting/qualitydistribution/fpsmineables/fpsmineable_qualitydistribution_default.xml';
const overridePath =
  'libs/foundry/records/crafting/qualitydistribution/shipmineables/commonshipmineable_qualityoverride_pyro.xml';
const gatherablePath =
  'libs/foundry/records/crafting/qualitydistribution/harvestables/gatherable_qualitydistribution_default.xml';
const pyroPath = 'libs/foundry/records/starmap/pu/pyrosolarsystem.xml';

test('extractDataCoreMiningQualityDistributions extracts mining default and location override rows', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-mining-quality-distributions-'));
  await writeXml(
    xmlCacheDir,
    defaultPath,
    `
      <CraftingQualityDistributionRecord.FPSMineable_QualityDistribution_Default __type="CraftingQualityDistributionRecord" __ref="ef749246-fa19-45bf-ae65-1d5a02e51c98" __path="${defaultPath}">
        <qualityDistribution>
          <CraftingQualityDistributionNormal min="201" max="1000" mean="201" stddev="298" />
        </qualityDistribution>
      </CraftingQualityDistributionRecord.FPSMineable_QualityDistribution_Default>
    `,
  );
  await writeXml(
    xmlCacheDir,
    overridePath,
    `
      <CraftingQualityLocationOverrideRecord.CommonShipMineable_QualityOverride_Pyro __type="CraftingQualityLocationOverrideRecord" __ref="6b3f9232-d6f7-4ce9-8c30-f21aab55f073" __path="${overridePath}">
        <locationOverride>
          <CraftingQualityLocationOverride>
            <locationOverrideList>
              <CraftingQualityLocationOverrideEntry location="99999999-9999-9999-9999-999999999998">
                <qualityDistribution>
                  <CraftingQualityDistributionNormal min="501" max="1000" mean="104" stddev="214" />
                </qualityDistribution>
              </CraftingQualityLocationOverrideEntry>
            </locationOverrideList>
          </CraftingQualityLocationOverride>
        </locationOverride>
      </CraftingQualityLocationOverrideRecord.CommonShipMineable_QualityOverride_Pyro>
    `,
  );
  await writeXml(
    xmlCacheDir,
    gatherablePath,
    `
      <CraftingQualityDistributionRecord.Gatherable_QualityDistribution_Default __type="CraftingQualityDistributionRecord" __ref="99999999-9999-9999-9999-999999999999" __path="${gatherablePath}">
        <qualityDistribution>
          <CraftingQualityDistributionNormal min="1" max="2" mean="1" stddev="1" />
        </qualityDistribution>
      </CraftingQualityDistributionRecord.Gatherable_QualityDistribution_Default>
    `,
  );

  const rows = await extractDataCoreMiningQualityDistributions({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph()),
  });

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    ref: 'ef749246-fa19-45bf-ae65-1d5a02e51c98',
    path: defaultPath,
    distributionClass: 'FPSMineable_QualityDistribution_Default',
    distributionType: 'default',
    mineableFamily: 'fpsmineables',
    locationGuid: '',
    locationClass: '',
    locationPath: '',
    minQuality: '201',
    maxQuality: '1000',
    mean: '201',
    stddev: '298',
  });
  assert.deepEqual(rows[1], {
    ref: '6b3f9232-d6f7-4ce9-8c30-f21aab55f073',
    path: overridePath,
    distributionClass: 'CommonShipMineable_QualityOverride_Pyro',
    distributionType: 'location-override',
    mineableFamily: 'shipmineables',
    locationGuid: '286cb603-b4ae-4279-80a1-d4505fee1916',
    locationClass: 'PyroSolarSystem',
    locationPath: pyroPath,
    minQuality: '501',
    maxQuality: '1000',
    mean: '104',
    stddev: '214',
  });
});

test('extractDataCoreMiningQualityDistributions does not use XML fallback when graph location refs are ambiguous', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-mining-quality-distributions-ambiguous-'));
  await writeXml(
    xmlCacheDir,
    overridePath,
    `
      <CraftingQualityLocationOverrideRecord.CommonShipMineable_QualityOverride_Pyro __type="CraftingQualityLocationOverrideRecord" __ref="6b3f9232-d6f7-4ce9-8c30-f21aab55f073" __path="${overridePath}">
        <locationOverride>
          <CraftingQualityLocationOverride>
            <locationOverrideList>
              <CraftingQualityLocationOverrideEntry location="99999999-9999-9999-9999-999999999998">
                <qualityDistribution>
                  <CraftingQualityDistributionNormal min="501" max="1000" mean="104" stddev="214" />
                </qualityDistribution>
              </CraftingQualityLocationOverrideEntry>
            </locationOverrideList>
          </CraftingQualityLocationOverride>
        </locationOverride>
      </CraftingQualityLocationOverrideRecord.CommonShipMineable_QualityOverride_Pyro>
    `,
  );
  const graph = makeGraph();
  graph.records[1].referencedGuids = ['286cb603-b4ae-4279-80a1-d4505fee1916', 'other-location-guid'];
  graph.records[1].referencedGuidAttributes = [
    { attribute: 'location', value: '286cb603-b4ae-4279-80a1-d4505fee1916' },
    { attribute: 'location', value: 'other-location-guid' },
  ];

  const [row] = await extractDataCoreMiningQualityDistributions({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(graph),
    pathPrefix: overridePath,
  });

  assert.equal(row.locationGuid, '');
  assert.equal(row.locationClass, '');
  assert.equal(row.locationPath, '');
});

async function writeXml(xmlCacheDir: string, recordPath: string, xml: string): Promise<void> {
  const xmlPath = path.join(xmlCacheDir, recordPath);
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(xmlPath, xml, 'utf8');
}

function makeGraph(): DataCoreRecordGraph {
  const records: DataCoreRecordNode[] = [
    node(
      defaultPath,
      'ef749246-fa19-45bf-ae65-1d5a02e51c98',
      'CraftingQualityDistributionRecord',
      'FPSMineable_QualityDistribution_Default',
    ),
    node(
      overridePath,
      '6b3f9232-d6f7-4ce9-8c30-f21aab55f073',
      'CraftingQualityLocationOverrideRecord',
      'CommonShipMineable_QualityOverride_Pyro',
      [{ attribute: 'location', value: '286cb603-b4ae-4279-80a1-d4505fee1916' }],
    ),
    node(
      gatherablePath,
      '99999999-9999-9999-9999-999999999999',
      'CraftingQualityDistributionRecord',
      'Gatherable_QualityDistribution_Default',
    ),
    node(pyroPath, '286cb603-b4ae-4279-80a1-d4505fee1916', 'StarMapObject', 'PyroSolarSystem'),
  ];

  return {
    source: 'datacore-record-graph',
    recordCount: records.length,
    records,
    indexes: {
      byRef: Object.fromEntries(records.map((record) => [record.ref, record.path])),
      byPath: Object.fromEntries(records.map((record, index) => [record.path, index])),
      byRootType: {
        CraftingQualityDistributionRecord: [defaultPath, gatherablePath],
        CraftingQualityLocationOverrideRecord: [overridePath],
        StarMapObject: [pyroPath],
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
  referencedGuidAttributes: NonNullable<DataCoreRecordNode['referencedGuidAttributes']> = [],
): DataCoreRecordNode {
  return {
    path: pathValue,
    ref,
    rootTag: `${rootType}.${entityClass}`,
    rootType,
    entityClass,
    localizationKeys: [],
    referencedGuids: referencedGuidAttributes.map((reference) => reference.value),
    referencedGuidAttributes,
  };
}
