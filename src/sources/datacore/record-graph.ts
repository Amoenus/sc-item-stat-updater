import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import Piscina from 'piscina';
import { mapConcurrent } from './concurrency';
import type {
  DataCoreGuidReference,
  DataCoreLocalizationReference,
  DataCoreRecordGraph,
  DataCoreRecordNode,
} from './types';
import { collectDataCoreXmlFiles } from './xml-files';

const LOCALIZATION_ATTRIBUTES = [
  'Name',
  'ShortName',
  'shortName',
  'Description',
  'name',
  'description',
  'displayName',
  'displayDescription',
  'displayType',
  'title',
  'titleHUD',
  'missionGiver',
  'commsChannelName',
  'vehicleName',
  'vehicleDescription',
  'vehicleCareer',
  'vehicleRole',
  'depositName',
  'orderDisplayName',
  'callout1',
  'callout2',
  'callout3',
  'textId',
  'titleOverride',
  'descriptionOverride',
] as const;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerPath = path.resolve(__dirname, 'record-graph-worker.ts');
const GUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export interface BuildDataCoreRecordGraphOptions {
  xmlCacheDir: string;
  onStart?: (total: number) => void;
  onProgress?: (current: number, total: number) => void;
}
export async function buildDataCoreRecordGraph(options: BuildDataCoreRecordGraphOptions): Promise<DataCoreRecordGraph> {
  const xmlFiles = await collectDataCoreXmlFiles(options.xmlCacheDir);
  options.onStart?.(xmlFiles.length);

  let current = 0;

  const piscina = new Piscina({
    filename: workerPath,
    execArgv: ['--import', 'tsx/esm'],
  });

  const rawRecords = await mapConcurrent(
    xmlFiles.sort((a, b) => a.localeCompare(b)),
    async (xmlPath) => {
      const result = await piscina.run({ xmlPath, xmlCacheDir: options.xmlCacheDir });
      current++;
      if (current % 250 === 0) options.onProgress?.(current, xmlFiles.length);
      return result as DataCoreRecordNode | null;
    },
    piscina.options.maxThreads * 2,
  );

  const records = rawRecords.filter((r): r is DataCoreRecordNode => r !== null);
  options.onProgress?.(xmlFiles.length, xmlFiles.length);
  return buildGraph(records);
}

export async function writeDataCoreRecordGraph(graph: DataCoreRecordGraph, outputPath: string): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(graph, null, 2)}\n`, 'utf8');
}

function flattenString(str: string | undefined | null): string {
  if (!str) return '';
  return Buffer.from(str).toString();
}

export function extractRecordNode($: CheerioAPI, rootElement: Element, recordPath: string): DataCoreRecordNode {
  const root = $(rootElement);
  const rootTag = flattenString(rootElement.name);
  const rootType = flattenString(root.attr('__type') ?? rootTag.split('.')[0] ?? rootTag);
  const referencedGuidAttributes = extractGuidAttributeReferences($, rootElement);

  return {
    path: flattenString(recordPath),
    ref: flattenString(root.attr('__ref')),
    rootTag,
    rootType,
    entityClass: flattenString(extractRecordEntityClass(rootTag)),
    localizationKeys: extractLocalizationReferences($),
    referencedGuids: uniqueSorted(referencedGuidAttributes.map((reference) => reference.value)),
    referencedGuidAttributes,
  };
}

function extractRecordEntityClass(rootTag: string): string {
  const dot = rootTag.indexOf('.');
  return dot === -1 ? '' : rootTag.slice(dot + 1);
}

function extractLocalizationReferences($: CheerioAPI): DataCoreLocalizationReference[] {
  const references: DataCoreLocalizationReference[] = [];
  const seen = new Set<string>();
  const addReference = (attribute: string, rawKey: string | undefined): void => {
    const key = rawKey?.trim().startsWith('@') ? rawKey.trim().slice(1).trim() : '';
    if (!key) return;

    const flatAttribute = flattenString(attribute);
    const flatKey = flattenString(key);
    const fingerprint = `${flatAttribute}\0${flatKey}`;
    if (seen.has(fingerprint)) return;

    seen.add(fingerprint);
    references.push({ attribute: flatAttribute, key: flatKey });
  };

  $('*').each((_, element) => {
    if (element.type !== 'tag') return;

    for (const attribute of LOCALIZATION_ATTRIBUTES) {
      addReference(attribute, $(element).attr(attribute));
    }
  });

  $('MissionProperty[missionVariableName]').each((_, element) => {
    const missionVariableName = $(element).attr('missionVariableName')?.trim();
    if (!missionVariableName) return;
    const contractId = $(element).parents('[id]').first().attr('id')?.trim();
    if (!contractId) return;

    $(element)
      .find('MissionPropertyValueOption_StringHash[textId]')
      .each((__, optionElement) => {
        addReference(`contract:${contractId}:${missionVariableName}.textId`, $(optionElement).attr('textId'));
      });
  });

  $('ObjectiveToken > displayInfo').each((_, element) => {
    addReference('objectiveDisplayInfo.shortDescription', $(element).attr('shortDescription'));
    addReference('objectiveDisplayInfo.longDescription', $(element).attr('longDescription'));
    addReference('objectiveDisplayInfo.objectiveMarkerLabel', $(element).attr('objectiveMarkerLabel'));
  });

  $('travelObjectiveInfo').each((_, element) => {
    addReference('travelObjectiveInfo.shortDescription', $(element).attr('shortDescription'));
    addReference('travelObjectiveInfo.longDescription', $(element).attr('longDescription'));
    addReference('travelObjectiveInfo.objectiveMarkerLabel', $(element).attr('objectiveMarkerLabel'));
  });

  $('returnObjectiveInfo').each((_, element) => {
    addReference('returnObjectiveInfo.shortDescription', $(element).attr('shortDescription'));
    addReference('returnObjectiveInfo.longDescription', $(element).attr('longDescription'));
    addReference('returnObjectiveInfo.objectiveMarkerLabel', $(element).attr('objectiveMarkerLabel'));
  });

  $('NavPointSpawnInformation').each((_, element) => {
    addReference('NavPointSpawnInformation.name', $(element).attr('name'));
  });

  $('SReputationContextBBPropertyParams[name]').each((_, element) => {
    const propertyName = $(element).attr('name')?.trim();
    if (!propertyName) return;
    addReference(`reputationProperty:${propertyName}`, $(element).find('SBBDynamicPropertyLocString').first().attr('value'));
  });

  return references.sort((a, b) => a.key.localeCompare(b.key) || a.attribute.localeCompare(b.attribute));
}

function isUsableLocalizationKey(value: string): boolean {
  return value !== '' && !/^LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i.test(value);
}

function extractGuidAttributeReferences($: CheerioAPI, rootElement: Element): DataCoreGuidReference[] {
  const references: DataCoreGuidReference[] = [];
  const seen = new Set<string>();

  $('*').each((_, element) => {
    if (element.type !== 'tag') return;

    for (const [attribute, rawValue] of Object.entries(element.attribs ?? {})) {
      if (element === rootElement && attribute === '__ref') continue;

      for (const guid of rawValue.match(GUID_PATTERN) ?? []) {
        const value = flattenString(guid.toLowerCase());
        const flatAttribute = flattenString(attribute);
        const fingerprint = `${flatAttribute}\0${value}`;
        if (seen.has(fingerprint)) continue;

        seen.add(fingerprint);
        references.push({ attribute: flatAttribute, value });
      }
    }
  });

  return references.sort((a, b) => a.value.localeCompare(b.value) || a.attribute.localeCompare(b.attribute));
}

export function normalizedRecordPath(root: ReturnType<CheerioAPI>, xmlPath: string, xmlCacheDir: string): string {
  const pathAttr = root.attr('__path');
  if (pathAttr) return pathAttr.replaceAll('\\', '/');

  return path.relative(xmlCacheDir, xmlPath).replaceAll('\\', '/');
}

function buildGraph(records: DataCoreRecordNode[]): DataCoreRecordGraph {
  const graph: DataCoreRecordGraph = {
    source: 'datacore-record-graph',
    recordCount: records.length,
    records,
    indexes: {
      byRef: {},
      byPath: {},
      byRootType: {},
      byEntityClass: {},
      byLocalizationKey: {},
      byReferencedGuid: {},
    },
  };

  for (const [recordIndex, record] of records.entries()) {
    graph.indexes.byPath[record.path] = recordIndex;
    if (record.ref) graph.indexes.byRef[record.ref] = record.path;
    addToIndex(graph.indexes.byRootType, record.rootType, record.path);
    addToIndex(graph.indexes.byEntityClass, record.entityClass, record.path);

    for (const { key } of record.localizationKeys.filter((reference) => isUsableLocalizationKey(reference.key))) {
      addToIndex(graph.indexes.byLocalizationKey, key, record.path);
    }

    for (const guid of record.referencedGuids) {
      addToIndex(graph.indexes.byReferencedGuid, guid, record.path);
    }
  }

  return graph;
}

function addToIndex(index: Record<string, string[]>, key: string, value: string): void {
  if (!key) return;
  index[key] ??= [];
  if (!index[key].includes(value)) index[key].push(value);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
