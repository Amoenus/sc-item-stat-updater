import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreMiningCompositions } from './mining-composition-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph, DataCoreRecordNode } from './types';

const compositionPath = 'libs/foundry/records/mining/rockcompositionpresets/asteroid_ctype_aluminium.xml';
const singleCompositionPath = 'libs/foundry/records/mining/rockcompositionpresets/asteroid_ctype_aluminium_single.xml';
const elementPath = 'libs/foundry/records/mining/mineableelements/aluminium_ore.xml';

test('extractDataCoreMiningCompositions flattens composition parts and resolves mineable element refs', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-mining-compositions-'));
  await writeXml(
    xmlCacheDir,
    compositionPath,
    `
      <MineableComposition.Asteroid_CType_Aluminium depositName="@hud_mining_asteroid_name_stale" minimumDistinctElements="2" __type="MineableComposition" __ref="3a6e7bb4-0f23-4c46-b822-333afe9d63ab" __path="${compositionPath}">
        <compositionArray>
          <MineableCompositionPart mineableElement="3776294d-5689-41f2-b03d-e8fcd17ede6a" minPercentage="30" maxPercentage="70" probability="1" curveExponent="1" qualityScale="1" />
          <MineableCompositionPart mineableElement="missing-guid" minPercentage="20" maxPercentage="50" probability="0.1" curveExponent="2" qualityScale="0.8" />
        </compositionArray>
      </MineableComposition.Asteroid_CType_Aluminium>
    `,
  );
  await writeXml(
    xmlCacheDir,
    singleCompositionPath,
    `
      <MineableComposition.Asteroid_CType_Aluminium_Single depositName="@hud_mining_asteroid_name_stale" minimumDistinctElements="1" __type="MineableComposition" __ref="4a6e7bb4-0f23-4c46-b822-333afe9d63ab" __path="${singleCompositionPath}">
        <compositionArray>
          <MineableCompositionPart mineableElement="missing-guid" minPercentage="100" maxPercentage="100" probability="1" curveExponent="1" qualityScale="1" />
        </compositionArray>
      </MineableComposition.Asteroid_CType_Aluminium_Single>
    `,
  );

  const rows = await extractDataCoreMiningCompositions({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph()),
  });

  assert.equal(rows.length, 3);
  const aluminium = rows.find((row) => row.compositionClass === 'Asteroid_CType_Aluminium' && row.partIndex === '0');
  const fallbackPart = rows.find((row) => row.compositionClass === 'Asteroid_CType_Aluminium' && row.partIndex === '1');
  const single = rows.find((row) => row.compositionClass === 'Asteroid_CType_Aluminium_Single');

  assert.deepEqual(aluminium, {
    ref: '3a6e7bb4-0f23-4c46-b822-333afe9d63ab',
    path: compositionPath,
    compositionClass: 'Asteroid_CType_Aluminium',
    depositNameKey: 'hud_mining_asteroid_name_5',
    minimumDistinctElements: '2',
    partIndex: '0',
    mineableElementGuid: '3776294d-5689-41f2-b03d-e8fcd17ede6a',
    mineableElementClass: 'Aluminium_Ore',
    mineableElementName: 'Aluminum (Ore)',
    minPercentage: '30',
    maxPercentage: '70',
    probability: '1',
    curveExponent: '1',
    qualityScale: '1',
  });
  assert.equal(fallbackPart?.mineableElementGuid, 'missing-guid');
  assert.equal(fallbackPart?.mineableElementClass, '');
  assert.equal(fallbackPart?.curveExponent, '2');
  assert.equal(single?.mineableElementGuid, '3776294d-5689-41f2-b03d-e8fcd17ede6a');
  assert.equal(single?.mineableElementClass, 'Aluminium_Ore');
});

async function writeXml(xmlCacheDir: string, recordPath: string, xml: string): Promise<void> {
  const xmlPath = path.join(xmlCacheDir, recordPath);
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(xmlPath, xml, 'utf8');
}

function makeGraph(): DataCoreRecordGraph {
  const records: DataCoreRecordNode[] = [
    {
      path: compositionPath,
      ref: '3a6e7bb4-0f23-4c46-b822-333afe9d63ab',
      rootTag: 'MineableComposition.Asteroid_CType_Aluminium',
      rootType: 'MineableComposition',
      entityClass: 'Asteroid_CType_Aluminium',
      localizationKeys: [
        { attribute: 'depositName', key: 'LOC_PLACEHOLDER' },
        { attribute: 'depositName', key: 'hud_mining_asteroid_name_5' },
      ],
      referencedGuids: [],
    },
    {
      path: singleCompositionPath,
      ref: '4a6e7bb4-0f23-4c46-b822-333afe9d63ab',
      rootTag: 'MineableComposition.Asteroid_CType_Aluminium_Single',
      rootType: 'MineableComposition',
      entityClass: 'Asteroid_CType_Aluminium_Single',
      localizationKeys: [],
      referencedGuids: ['3776294d-5689-41f2-b03d-e8fcd17ede6a'],
      referencedGuidAttributes: [{ attribute: 'mineableElement', value: '3776294d-5689-41f2-b03d-e8fcd17ede6a' }],
    },
    {
      path: elementPath,
      ref: '3776294d-5689-41f2-b03d-e8fcd17ede6a',
      rootTag: 'MineableElement.Aluminium_Ore',
      rootType: 'MineableElement',
      entityClass: 'Aluminium_Ore',
      localizationKeys: [],
      referencedGuids: [],
    },
  ];

  return {
    source: 'datacore-record-graph',
    recordCount: records.length,
    records,
    indexes: {
      byRef: Object.fromEntries(records.map((record) => [record.ref, record.path])),
      byPath: Object.fromEntries(records.map((record, index) => [record.path, index])),
      byRootType: {
        MineableComposition: [compositionPath, singleCompositionPath],
        MineableElement: [elementPath],
      },
      byEntityClass: {},
      byLocalizationKey: {},
      byReferencedGuid: {},
    },
  };
}
