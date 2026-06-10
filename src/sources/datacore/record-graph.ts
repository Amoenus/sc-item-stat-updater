import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import Piscina from 'piscina';
import { mapConcurrent } from './concurrency';
import type { DataCoreLocalizationReference, DataCoreRecordGraph, DataCoreRecordNode } from './types';
import { collectDataCoreXmlFiles } from './xml-files';

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerPath = path.resolve(__dirname, 'record-graph-worker.ts');

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

  return {
    path: flattenString(recordPath),
    ref: flattenString(root.attr('__ref')),
    rootTag,
    rootType,
    entityClass: flattenString(extractRecordEntityClass(rootTag)),
    localizationKeys: extractLocalizationReferences($),
    referencedGuids: uniqueSorted(
      $('Reference[value]')
        .toArray()
        .map((element) => flattenString($(element).attr('value')?.trim()))
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

      const flatAttribute = flattenString(attribute);
      const flatKey = flattenString(key);

      const fingerprint = `${flatAttribute}\0${flatKey}`;
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      references.push({ attribute: flatAttribute, key: flatKey });
    }
  });

  return references.sort((a, b) => a.key.localeCompare(b.key) || a.attribute.localeCompare(b.attribute));
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
