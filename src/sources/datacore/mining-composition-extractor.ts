import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import { uniqueGraphGuidReference, graphLocalizationKeyWithFallback } from './record-graph-relations';
import type { DataCoreMiningCompositionPartRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_MINING_COMPOSITION_PATH_PREFIX = 'libs/foundry/records/mining/rockcompositionpresets';
const COMMODITY_SLUG_ALIASES: Record<string, string> = {
  aluminium: 'aluminum',
};

export interface ExtractDataCoreMiningCompositionsOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  pathPrefix?: string;
}

export async function extractDataCoreMiningCompositions(
  options: ExtractDataCoreMiningCompositionsOptions,
): Promise<DataCoreMiningCompositionPartRecord[]> {
  const records = options.graph
    .getByPathPrefix(options.pathPrefix ?? DEFAULT_MINING_COMPOSITION_PATH_PREFIX)
    .filter((record) => record.rootType === 'MineableComposition')
    .sort((a, b) => a.path.localeCompare(b.path));
  const rows: DataCoreMiningCompositionPartRecord[] = [];

  for (const record of records) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore mining composition XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const root = $(':root').first();
    if (!root.length) continue;

    $('MineableCompositionPart').each((index, element) => {
      const part = $(element);
      const mineableElementGuid = part.attr('mineableElement')
        ? graphGuidReference(record, ['mineableElement'], part.attr('mineableElement') ?? '')
        : '';
      const mineableElement = mineableElementGuid ? options.graph.getByRef(mineableElementGuid) : undefined;

      rows.push({
        ref: record.ref,
        path: record.path,
        compositionClass: record.entityClass,
        depositNameKey: graphLocalizationKeyWithFallback(record, ['depositName'], root.attr('depositName') ?? ''),
        minimumDistinctElements: root.attr('minimumDistinctElements') ?? '',
        partIndex: String(index),
        mineableElementGuid,
        mineableElementClass: mineableElement?.entityClass ?? '',
        mineableElementName: mineableElement ? toElementName(mineableElement.entityClass) : '',
        minPercentage: part.attr('minPercentage') ?? '',
        maxPercentage: part.attr('maxPercentage') ?? '',
        probability: part.attr('probability') ?? '',
        curveExponent: part.attr('curveExponent') ?? '',
        qualityScale: part.attr('qualityScale') ?? '',
      });
    });
  }

  return rows;
}

function graphGuidReference(record: DataCoreRecordNode, attributes: string[], fallback: string): string {
  return uniqueGraphGuidReference(record, attributes, fallback);
}

function toElementName(elementClass: string): string {
  const normalized = elementClass
    .replace(/^MinableElement_/i, '')
    .replace(/^MineableElement_/i, '')
    .replace(/^FPS_/i, '')
    .replace(/^GroundVehicle_/i, '');
  const suffixMatch = /^(.+)_(Ore|Raw)$/i.exec(normalized);
  if (suffixMatch) return `${toTitleWords(suffixMatch[1])} (${toTitleWords(suffixMatch[2])})`;

  return toTitleWords(normalized);
}

function toTitleWords(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\w\S*/g, (word) => {
      const normalized = COMMODITY_SLUG_ALIASES[word.toLowerCase()] ?? word;
      return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
    });
}
