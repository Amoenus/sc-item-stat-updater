import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreMiningClustering } from './mining-clustering-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

const clusteringPath = 'libs/foundry/records/harvestable/clusteringpresets/asteroid_lrg_med_sml.xml';
const nonClusteringPath = 'libs/foundry/records/harvestable/clusteringpresets/readme.xml';

test('extractDataCoreMiningClustering flattens harvestable clustering params', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-mining-clustering-'));
  await writeXml(
    xmlCacheDir,
    clusteringPath,
    `
      <HarvestableClusterPreset.Asteroid_Lrg_Med_Sml probabilityOfClustering="10" __type="HarvestableClusterPreset" __ref="70128b72-7c50-4315-bed8-59a1c2ef7996" __path="${clusteringPath}">
        <clusterParamsArray>
          <HarvestableClusterParams relativeProbability="0.1" minSize="4" maxSize="5" minProximity="5" maxProximity="15" />
          <HarvestableClusterParams relativeProbability="1" minSize="2" maxSize="3" minProximity="2" maxProximity="5" />
        </clusterParamsArray>
      </HarvestableClusterPreset.Asteroid_Lrg_Med_Sml>
    `,
  );
  await writeXml(
    xmlCacheDir,
    nonClusteringPath,
    `<NotAClusterPreset.Test __type="NotAClusterPreset" __ref="ignore-guid" __path="${nonClusteringPath}" />`,
  );

  const rows = await extractDataCoreMiningClustering({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph()),
  });

  assert.deepEqual(rows, [
    {
      ref: '70128b72-7c50-4315-bed8-59a1c2ef7996',
      path: clusteringPath,
      clusteringClass: 'Asteroid_Lrg_Med_Sml',
      probabilityOfClustering: '10',
      paramIndex: '0',
      relativeProbability: '0.1',
      minSize: '4',
      maxSize: '5',
      minProximity: '5',
      maxProximity: '15',
    },
    {
      ref: '70128b72-7c50-4315-bed8-59a1c2ef7996',
      path: clusteringPath,
      clusteringClass: 'Asteroid_Lrg_Med_Sml',
      probabilityOfClustering: '10',
      paramIndex: '1',
      relativeProbability: '1',
      minSize: '2',
      maxSize: '3',
      minProximity: '2',
      maxProximity: '5',
    },
  ]);
});

async function writeXml(xmlCacheDir: string, recordPath: string, xml: string): Promise<void> {
  const xmlPath = path.join(xmlCacheDir, recordPath);
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(xmlPath, xml, 'utf8');
}

function makeGraph(): DataCoreRecordGraph {
  return {
    source: 'datacore-record-graph',
    recordCount: 2,
    records: [
      {
        path: clusteringPath,
        ref: '70128b72-7c50-4315-bed8-59a1c2ef7996',
        rootTag: 'HarvestableClusterPreset.Asteroid_Lrg_Med_Sml',
        rootType: 'HarvestableClusterPreset',
        entityClass: 'Asteroid_Lrg_Med_Sml',
        localizationKeys: [],
        referencedGuids: [],
      },
      {
        path: nonClusteringPath,
        ref: 'ignore-guid',
        rootTag: 'NotAClusterPreset.Test',
        rootType: 'NotAClusterPreset',
        entityClass: 'Test',
        localizationKeys: [],
        referencedGuids: [],
      },
    ],
    indexes: {
      byRef: {
        '70128b72-7c50-4315-bed8-59a1c2ef7996': clusteringPath,
        'ignore-guid': nonClusteringPath,
      },
      byPath: {
        [clusteringPath]: 0,
        [nonClusteringPath]: 1,
      },
      byRootType: {
        HarvestableClusterPreset: [clusteringPath],
        NotAClusterPreset: [nonClusteringPath],
      },
      byEntityClass: {},
      byLocalizationKey: {},
      byReferencedGuid: {},
    },
  };
}
