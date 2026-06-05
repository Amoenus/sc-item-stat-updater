import fs from 'node:fs/promises';
import path from 'node:path';
import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import type { DataCoreLocalizationReference, DataCoreRecordGraph, DataCoreRecordNode } from './types';
import { collectDataCoreXmlFiles } from './xml-files';
import { loadXml } from './xml-parser';

const LOCALIZATION_ATTRIBUTES = [
  'Name',
  'Description',
  'name',
  'description',
  'displayName',
  'displayDescription',
  'displayType',
  'title',
  'vehicleName',
  'vehicleDescription',
] as const;

export interface BuildDataCoreRecordGraphOptions {
  xmlCacheDir: string;
}

export async function buildDataCoreRecordGraph(options: BuildDataCoreRecordGraphOptions): Promise<DataCoreRecordGraph> {
  const xmlFiles = await collectDataCoreXmlFiles(options.xmlCacheDir);
  const records: DataCoreRecordNode[] = [];

  for (const xmlPath of xmlFiles.sort((a, b) => a.localeCompare(b))) {
    const xml = await fs.readFile(xmlPath, 'utf8');
    let $: CheerioAPI;
    try {
      $ = loadXml(xml);
    } catch {
      continue;
    }

    const root = $(':root').first();
    const rootElement = root[0];
    if (rootElement?.type !== 'tag') continue;

    records.push(extractRecordNode($, rootElement, normalizedRecordPath(root, xmlPath, options.xmlCacheDir)));
  }

  return buildGraph(records);
}

export async function writeDataCoreRecordGraph(graph: DataCoreRecordGraph, outputPath: string): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(graph, null, 2)}\n`, 'utf8');
}

function extractRecordNode($: CheerioAPI, rootElement: Element, recordPath: string): DataCoreRecordNode {
  const root = $(rootElement);
  const rootTag = rootElement.name;
  const rootType = root.attr('__type') ?? rootTag.split('.')[0] ?? rootTag;

  return {
    path: recordPath,
    ref: root.attr('__ref') ?? '',
    rootTag,
    rootType,
    entityClass: extractRecordEntityClass(rootTag),
    localizationKeys: extractLocalizationReferences($),
    referencedGuids: uniqueSorted(
      $('Reference[value]')
        .toArray()
        .map((element) => $(element).attr('value')?.trim() ?? '')
        .filter(Boolean),
    ),
  };
}

function extractRecordEntityClass(rootTag: string): string {
  const dot = rootTag.indexOf('.');
  return dot === -1 ? '' : rootTag.slice(dot + 1);
}

function extractLocalizationReferences($: CheerioAPI): DataCoreLocalizationReference[] {
  const references: DataCoreLocalizationReference[] = [];
  const seen = new Set<string>();

  $('*').each((_, element) => {
    if (element.type !== 'tag') return;

    for (const attribute of LOCALIZATION_ATTRIBUTES) {
      const rawKey = $(element).attr(attribute)?.trim();
      const key = rawKey?.startsWith('@') ? rawKey.slice(1).trim() : '';
      if (!key) continue;

      const fingerprint = `${attribute}\0${key}`;
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      references.push({ attribute, key });
    }
  });

  return references.sort((a, b) => a.key.localeCompare(b.key) || a.attribute.localeCompare(b.attribute));
}

function normalizedRecordPath(root: ReturnType<CheerioAPI>, xmlPath: string, xmlCacheDir: string): string {
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

    for (const { key } of record.localizationKeys) {
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
