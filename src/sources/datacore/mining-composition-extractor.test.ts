import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreMiningCompositions } from './mining-composition-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

const compositionPath = 'libs/foundry/records/mining/rockcompositionpresets/asteroid_ctype_aluminium.xml';
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

  const rows = await extractDataCoreMiningCompositions({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph()),
  });

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
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
  assert.equal(rows[1].mineableElementGuid, 'missing-guid');
  assert.equal(rows[1].mineableElementClass, '');
  assert.equal(rows[1].curveExponent, '2');
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
        path: compositionPath,
        ref: '3a6e7bb4-0f23-4c46-b822-333afe9d63ab',
        rootTag: 'MineableComposition.Asteroid_CType_Aluminium',
        rootType: 'MineableComposition',
        entityClass: 'Asteroid_CType_Aluminium',
        localizationKeys: [{ attribute: 'depositName', key: 'hud_mining_asteroid_name_5' }],
        referencedGuids: [],
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
    ],
    indexes: {
      byRef: {
        '3a6e7bb4-0f23-4c46-b822-333afe9d63ab': compositionPath,
        '3776294d-5689-41f2-b03d-e8fcd17ede6a': elementPath,
      },
      byPath: {
        [compositionPath]: 0,
        [elementPath]: 1,
      },
      byRootType: {
        MineableComposition: [compositionPath],
        MineableElement: [elementPath],
      },
      byEntityClass: {},
      byLocalizationKey: {},
      byReferencedGuid: {},
    },
  };
}
