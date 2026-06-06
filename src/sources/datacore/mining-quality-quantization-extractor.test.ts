import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreMiningQualityQuantizations } from './mining-quality-quantization-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

const agriciumPath = 'libs/foundry/records/crafting/qualityquantization/quantization_agricium.xml';
const nonMiningPath = 'libs/foundry/records/crafting/qualitydistribution/shipmineables/common.xml';

test('extractDataCoreMiningQualityQuantizations extracts mapped quality bands', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-mining-quality-quantization-'));
  await writeXml(
    xmlCacheDir,
    agriciumPath,
    `<CraftingQualityQuantizationRecord.Quantization_Agricium __type="CraftingQualityQuantizationRecord" __ref="quality-guid" __path="${agriciumPath}">
      <qualityQuantization>
        <CraftingQualityQuantization>
          <bands>
            <CraftingQualityQuantizationBand start="0" end="399" mappedValue="346" />
            <CraftingQualityQuantizationBand start="400" end="599" mappedValue="588" />
            <CraftingQualityQuantizationBand start="999" end="1000" mappedValue="1000" />
          </bands>
        </CraftingQualityQuantization>
      </qualityQuantization>
    </CraftingQualityQuantizationRecord.Quantization_Agricium>`,
  );

  const rows = await extractDataCoreMiningQualityQuantizations({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph()),
  });

  assert.deepEqual(rows, [
    {
      ref: 'quality-guid',
      path: agriciumPath,
      quantizationClass: 'Quantization_Agricium',
      elementToken: 'Agricium',
      qualityBands: '346 / 588 / 1000',
      bandRanges: '0-399:346 / 400-599:588 / 999-1000:1000',
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
      node(
        agriciumPath,
        'quality-guid',
        'CraftingQualityQuantizationRecord.Quantization_Agricium',
        'CraftingQualityQuantizationRecord',
        'Quantization_Agricium',
      ),
      node(
        nonMiningPath,
        'other-guid',
        'CraftingQualityDistributionRecord.Common',
        'CraftingQualityDistributionRecord',
        'Common',
      ),
    ],
    indexes: {
      byRef: {},
      byPath: {
        [agriciumPath]: 0,
        [nonMiningPath]: 1,
      },
      byRootType: {
        CraftingQualityQuantizationRecord: [agriciumPath],
        CraftingQualityDistributionRecord: [nonMiningPath],
      },
      byEntityClass: {},
      byLocalizationKey: {},
      byReferencedGuid: {},
    },
  };
}

function node(path: string, ref: string, rootTag: string, rootType: string, entityClass: string) {
  return {
    path,
    ref,
    rootTag,
    rootType,
    entityClass,
    localizationKeys: [],
    referencedGuids: [],
  };
}
