import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import { graphLocalizationKey, uniqueGraphGuidReference } from './record-graph-relations';
import type { DataCoreMiningElementRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_MINING_ELEMENT_PATH_PREFIX = 'libs/foundry/records/mining/mineableelements';
const COMMODITY_SLUG_ALIASES: Record<string, string> = {
  aluminium: 'aluminum',
  sileron: 'stileron',
};
const ELEMENT_DISPLAY_SLUG_ALIASES: Record<string, string> = {
  sileron: 'stileron',
};

export interface ExtractDataCoreMiningElementsOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  pathPrefix?: string;
}

export async function extractDataCoreMiningElements(
  options: ExtractDataCoreMiningElementsOptions,
): Promise<DataCoreMiningElementRecord[]> {
  const records = options.graph
    .getByPathPrefix(options.pathPrefix ?? DEFAULT_MINING_ELEMENT_PATH_PREFIX)
    .filter((record) => record.rootType === 'MineableElement')
    .sort((a, b) => a.path.localeCompare(b.path));
  const elements: DataCoreMiningElementRecord[] = [];

  for (const record of records) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore mining element XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const root = $(':root').first();
    if (!root.length) continue;

    const resourceTypeGuid = graphGuidReference(record, ['resourceType'], root.attr('resourceType') ?? '');
    elements.push({
      ref: record.ref,
      path: record.path,
      elementClass: record.entityClass,
      elementName: toElementName(record.entityClass),
      materialName: toMaterialName(record.entityClass),
      inferredDescriptionKey:
        getResourceDescriptionKey(options.graph, resourceTypeGuid) ?? toInferredDescriptionKey(record.entityClass),
      resourceTypeGuid,
      instability: root.attr('elementInstability') ?? '',
      resistance: root.attr('elementResistance') ?? '',
      optimalWindowMidpoint: root.attr('elementOptimalWindowMidpoint') ?? '',
      optimalWindowRandomness: root.attr('elementOptimalWindowMidpointRandomness') ?? '',
      optimalWindowThinness: root.attr('elementOptimalWindowThinness') ?? '',
      explosionMultiplier: root.attr('elementExplosionMultiplier') ?? '',
      clusterFactor: root.attr('elementClusterFactor') ?? '',
    });
  }

  return elements;
}

function getResourceDescriptionKey(graph: DataCoreRecordGraphLookup, resourceTypeGuid: string): string | undefined {
  const resource = resourceTypeGuid ? graph.getByRef(resourceTypeGuid) : undefined;
  if (!resource) return undefined;

  return (
    graphLocalizationKey(resource, ['Description', 'description', 'displayDescription']) ||
    resource.localizationKeys
      .map((reference) => localizationKey(reference.key))
      .find((key) => /_desc$/i.test(key)) ||
    undefined
  );
}

function graphGuidReference(record: DataCoreRecordNode, attributes: string[], fallback: string): string {
  return uniqueGraphGuidReference(record, attributes, fallback);
}

function localizationKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^@?LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i.test(trimmed)) return '';
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}

function toElementName(elementClass: string): string {
  const normalized = stripMiningPrefix(elementClass);
  const suffixMatch = /^(.+)_(Ore|Raw)$/i.exec(normalized);
  if (suffixMatch) return `${toElementDisplayName(suffixMatch[1])} (${toTitleWords(suffixMatch[2])})`;

  return toElementDisplayName(normalized);
}

function toMaterialName(elementClass: string): string {
  const normalized = stripMiningPrefix(elementClass);
  const suffixMatch = /^(.+)_(Ore|Raw)$/i.exec(normalized);
  const base = suffixMatch ? suffixMatch[1] : normalized;
  return toCommodityDisplayName(base);
}

function toInferredDescriptionKey(elementClass: string): string {
  const normalized = stripMiningPrefix(elementClass);
  const suffixMatch = /^(.+)_(ore|raw)$/i.exec(normalized);
  if (!suffixMatch) return '';

  const slug = toCommoditySlug(suffixMatch[1]);
  return `items_commodities_${slug}_${suffixMatch[2].toLowerCase()}_desc`;
}

function stripMiningPrefix(elementClass: string): string {
  return elementClass
    .replace(/^MinableElement_/i, '')
    .replace(/^MineableElement_/i, '')
    .replace(/^FPS_/i, '')
    .replace(/^GroundVehicle_/i, '');
}

function toCommoditySlug(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return COMMODITY_SLUG_ALIASES[slug] ?? slug;
}

function toElementDisplayName(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return toTitleWords(ELEMENT_DISPLAY_SLUG_ALIASES[slug] ?? value);
}

function toCommodityDisplayName(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return toTitleWords(COMMODITY_SLUG_ALIASES[slug] ?? value);
}

function toTitleWords(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}
