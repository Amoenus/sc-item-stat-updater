import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import Piscina from 'piscina';
import { mapConcurrent } from './concurrency';
import {
  isUsableDataCoreLocalizationKey,
  normalizeDataCoreAttributeValue,
  stripDataCoreLocalizationPrefix,
  uniqueSortedStrings,
} from './normalization';
import type {
  DataCoreGuidReference,
  DataCoreLocalizationReference,
  DataCoreRecordAttribute,
  DataCoreRecordAttributeValueType,
  DataCoreRecordGraph,
  DataCoreRecordNode,
} from './types';
import { collectDataCoreXmlFiles } from './xml-files';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerPath = path.resolve(__dirname, 'record-graph-worker.ts');
const GUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const FULL_GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMBER_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

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
  const attributes = collectRecordAttributes(rootElement);
  const referencedGuidAttributes = extractGuidAttributeReferences($, rootElement, attributes);

  return {
    path: flattenString(recordPath),
    ref: flattenString(root.attr('__ref')),
    rootTag,
    rootType,
    entityClass: flattenString(extractRecordEntityClass(rootTag)),
    attributes,
    localizationKeys: extractLocalizationReferences($, attributes),
    referencedGuids: uniqueSortedStrings(referencedGuidAttributes.map((reference) => reference.value)),
    referencedGuidAttributes,
  };
}

function extractRecordEntityClass(rootTag: string): string {
  const dot = rootTag.indexOf('.');
  return dot === -1 ? '' : rootTag.slice(dot + 1);
}

function collectRecordAttributes(rootElement: Element): DataCoreRecordAttribute[] {
  const attributes: DataCoreRecordAttribute[] = [];

  const visit = (element: Element, elementPath: string): void => {
    const tag = flattenString(element.name);
    for (const [attribute, rawValue] of Object.entries(element.attribs ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
      const flattenedRawValue = flattenString(rawValue);
      attributes.push({
        elementPath,
        tag,
        attribute: flattenString(attribute),
        rawValue: flattenedRawValue,
        normalizedValue: normalizeDataCoreAttributeValue(flattenedRawValue),
        valueType: inferAttributeValueType(flattenedRawValue),
      });
    }

    const childTagCounts = new Map<string, number>();
    for (const child of element.children ?? []) {
      if (child.type !== 'tag') continue;
      const childElement = child as Element;
      const childTag = flattenString(childElement.name);
      const index = (childTagCounts.get(childTag) ?? 0) + 1;
      childTagCounts.set(childTag, index);
      visit(childElement, `${elementPath}/${childTag}[${index}]`);
    }
  };

  visit(rootElement, flattenString(rootElement.name));
  return attributes.sort(
    (a, b) =>
      a.elementPath.localeCompare(b.elementPath) ||
      a.attribute.localeCompare(b.attribute) ||
      a.rawValue.localeCompare(b.rawValue),
  );
}

function inferAttributeValueType(value: string): DataCoreRecordAttributeValueType {
  const trimmed = value.trim();
  if (trimmed.startsWith('@')) return 'localizationKey';
  if (FULL_GUID_PATTERN.test(trimmed)) return 'guid';
  if (/^(?:true|false)$/i.test(trimmed)) return 'boolean';
  if (NUMBER_PATTERN.test(trimmed) && Number.isFinite(Number(trimmed))) return 'number';
  return 'string';
}

function extractLocalizationReferences(
  $: CheerioAPI,
  attributes: DataCoreRecordAttribute[],
): DataCoreLocalizationReference[] {
  const references: DataCoreLocalizationReference[] = [];
  const seen = new Set<string>();
  const addReference = (attribute: string, rawKey: string | undefined): void => {
    const key = rawKey?.trim().startsWith('@') ? stripDataCoreLocalizationPrefix(rawKey) : '';
    if (!key) return;

    const flatAttribute = flattenString(attribute);
    const flatKey = flattenString(key);
    const fingerprint = `${flatAttribute}\0${flatKey}`;
    if (seen.has(fingerprint)) return;

    seen.add(fingerprint);
    references.push({ attribute: flatAttribute, key: flatKey });
  };

  for (const attribute of attributes.filter((attribute) => attribute.valueType === 'localizationKey')) {
    addReference(attribute.attribute, attribute.rawValue);
  }

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

  $(':root')
    .first()
    .find('> generators > *')
    .each((_, handlerElement) => {
      const inheritedParams = readContractStringParams(
        $,
        $(handlerElement).find('> contractParams > stringParamOverrides'),
      );
      for (const section of ['introContracts', 'contracts']) {
        $(handlerElement)
          .find(`> ${section} > *[id]`)
          .each((__, contractElement) => {
            const contractId = $(contractElement).attr('id')?.trim();
            if (!contractId) return;
            const contractParams = readContractStringParams(
              $,
              $(contractElement).find('> paramOverrides > stringParamOverrides'),
            );
            for (const [param, value] of new Map([...inheritedParams, ...contractParams])) {
              addReference(`contract:${contractId}:ContractStringParam.${param}`, value);
            }
          });
      }
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
    addReference(
      `reputationProperty:${propertyName}`,
      $(element).find('SBBDynamicPropertyLocString').first().attr('value'),
    );
  });

  return references.sort((a, b) => a.key.localeCompare(b.key) || a.attribute.localeCompare(b.attribute));
}

function readContractStringParams($: CheerioAPI, root: ReturnType<CheerioAPI>): Map<string, string> {
  const params = new Map<string, string>();
  root.find('> ContractStringParam[param]').each((_, element) => {
    const param = $(element).attr('param')?.trim();
    if (param) params.set(param, $(element).attr('value') ?? '');
  });
  return params;
}

function extractGuidAttributeReferences(
  $: CheerioAPI,
  rootElement: Element,
  attributes: DataCoreRecordAttribute[],
): DataCoreGuidReference[] {
  const references: DataCoreGuidReference[] = [];
  const seen = new Set<string>();
  const addReference = (attribute: string, rawValue: string | undefined): void => {
    for (const guid of rawValue?.match(GUID_PATTERN) ?? []) {
      const value = flattenString(guid.toLowerCase());
      const flatAttribute = flattenString(attribute);
      const fingerprint = `${flatAttribute}\0${value}`;
      if (seen.has(fingerprint)) continue;

      seen.add(fingerprint);
      references.push({ attribute: flatAttribute, value });
    }
  };

  for (const attribute of attributes) {
    if (attribute.elementPath === flattenString(rootElement.name) && attribute.attribute === '__ref') continue;
    addReference(attribute.attribute, attribute.rawValue);
  }

  $('MissionProperty[missionVariableName="MissionLocation"]').each((_, element) => {
    const contractId = $(element).parents('[id]').first().attr('id')?.trim();
    if (!contractId) return;
    $(element)
      .find('MissionPropertyValue_Location Reference[value]')
      .each((__, referenceElement) => {
        addReference(`contract:${contractId}:MissionLocation.Reference.value`, $(referenceElement).attr('value'));
      });
  });

  $(':root')
    .first()
    .filter('[__type="ContractTemplate"]')
    .each((_, element) => {
      addReference('ContractTemplate.owner', $(element).attr('owner'));
    });

  $(':root')
    .first()
    .filter('[__type="MissionBrokerEntry"]')
    .each((_, element) => {
      addReference('MissionBrokerEntry.owner', $(element).attr('owner'));
      addReference('MissionBrokerEntry.type', $(element).attr('type'));
    });

  $(':root')
    .first()
    .filter('[__type="ContractTemplate"]')
    .find('> contractDisplayInfo > ContractDisplayInfo[type]')
    .each((_, element) => {
      addReference('contractDisplayInfo.type', $(element).attr('type'));
    });

  $(':root')
    .first()
    .filter('[__type="ContractTemplate"]')
    .find('MissionPropertyValue_Location Reference[value]')
    .each((_, referenceElement) => {
      addReference('template:MissionLocation.Reference.value', $(referenceElement).attr('value'));
    });

  $(':root')
    .first()
    .filter('[__type="ContractTemplate"]')
    .find('ObjectiveHandler_Hauling HaulingOrder_Resource[resource]')
    .each((index, element) => {
      addReference(`template:HaulingOrder_Resource:${index + 1}.resource`, $(element).attr('resource'));
    });

  $(':root')
    .first()
    .filter('[__type="CraftingBlueprintRecord"]')
    .find('CraftingRecipeCosts CraftingCost_Resource[resource]')
    .each((index, element) => {
      addReference(`CraftingRecipeCost:${index + 1}.resource`, $(element).attr('resource'));
    });

  $(':root')
    .first()
    .find('> generators > *')
    .each((_, handlerElement) => {
      for (const section of ['introContracts', 'contracts']) {
        $(handlerElement)
          .find(`> ${section} > *[id][template]`)
          .each((__, contractElement) => {
            const contractId = $(contractElement).attr('id')?.trim();
            if (!contractId) return;
            addReference(`contract:${contractId}:template`, $(contractElement).attr('template'));
          });
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

    for (const { key } of record.localizationKeys.filter((reference) =>
      isUsableDataCoreLocalizationKey(reference.key),
    )) {
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
