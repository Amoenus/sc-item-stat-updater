import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import { queryDataCoreRecords } from './record-graph-query';
import type { DataCoreMiningQualityQuantizationRecord, DataCoreRecordGraphLookup } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_QUALITY_QUANTIZATION_PATH_PREFIX = 'libs/foundry/records/crafting/qualityquantization';

export interface ExtractDataCoreMiningQualityQuantizationsOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  pathPrefix?: string;
}

export async function extractDataCoreMiningQualityQuantizations(
  options: ExtractDataCoreMiningQualityQuantizationsOptions,
): Promise<DataCoreMiningQualityQuantizationRecord[]> {
  const records = queryDataCoreRecords(options.graph, {
    pathPrefix: options.pathPrefix ?? DEFAULT_QUALITY_QUANTIZATION_PATH_PREFIX,
    rootType: 'CraftingQualityQuantizationRecord',
  });
  const rows: DataCoreMiningQualityQuantizationRecord[] = [];

  for (const record of records) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore mining quality quantization XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const bands = $('CraftingQualityQuantizationBand')
      .toArray()
      .map((element) => ({
        start: $(element).attr('start') ?? '',
        end: $(element).attr('end') ?? '',
        mappedValue: $(element).attr('mappedValue') ?? '',
      }))
      .filter((band) => band.mappedValue);
    if (bands.length === 0) continue;

    rows.push({
      ref: record.ref,
      path: record.path,
      quantizationClass: record.entityClass,
      elementToken: toElementToken(record.entityClass),
      qualityBands: bands.map((band) => band.mappedValue).join(' / '),
      bandRanges: bands.map((band) => `${band.start}-${band.end}:${band.mappedValue}`).join(' / '),
    });
  }

  return rows;
}

function toElementToken(quantizationClass: string): string {
  return quantizationClass.replace(/^Quantization_/i, '');
}
