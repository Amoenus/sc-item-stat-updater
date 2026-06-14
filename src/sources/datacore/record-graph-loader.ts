import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveChildPath } from '../../io/local/path-conventions';
import type {
  DataCoreGuidRecordReference,
  DataCoreLocalizationRecordReference,
  DataCoreRecordGraph,
  DataCoreRecordGraphLookup,
  DataCoreRecordNode,
} from './types';

export interface LoadDataCoreRecordGraphOptions {
  repoRoot?: string;
  version?: string;
  versionDir?: string;
  graphFilename?: string;
}

export async function loadDataCoreRecordGraph(
  options: LoadDataCoreRecordGraphOptions,
): Promise<DataCoreRecordGraphLookup> {
  const graphPath = resolveDataCoreRecordGraphPath(options);
  const graph = JSON.parse(await fs.readFile(graphPath, 'utf8')) as DataCoreRecordGraph;
  return createDataCoreRecordGraphLookup(graph);
}

export function resolveDataCoreRecordGraphPath(options: LoadDataCoreRecordGraphOptions): string {
  const graphFilename = options.graphFilename ?? 'record-graph.json';

  if (options.versionDir) {
    return resolveChildPath(options.versionDir, graphFilename, 'DataCore record graph filename');
  }

  if (!options.repoRoot || !options.version) {
    throw new Error('DataCore record graph loading requires versionDir or both repoRoot and version.');
  }

  const datacoreCsvDir = path.join(options.repoRoot, 'csv', 'datacore');
  const versionDir = resolveChildPath(datacoreCsvDir, options.version, 'DataCore version');
  return resolveChildPath(versionDir, graphFilename, 'DataCore record graph filename');
}

export function createDataCoreRecordGraphLookup(graph: DataCoreRecordGraph): DataCoreRecordGraphLookup {
  const recordsByPath = new Map<string, DataCoreRecordNode>();
  const recordsByAttributeName = new Map<string, DataCoreRecordNode[]>();
  const recordsByAttributeValue = new Map<string, DataCoreRecordNode[]>();
  const localizationReferencesByAttributeName = new Map<string, DataCoreLocalizationRecordReference[]>();
  const guidReferencesByAttributeName = new Map<string, DataCoreGuidRecordReference[]>();

  for (const record of graph.records) {
    recordsByPath.set(normalizeGraphPath(record.path), record);

    for (const attribute of record.attributes ?? []) {
      appendUniqueRecord(recordsByAttributeName, normalizeAttributeName(attribute.attribute), record);
      appendUniqueRecord(recordsByAttributeValue, normalizeAttributeValue(attribute.rawValue), record);
      appendUniqueRecord(recordsByAttributeValue, normalizeAttributeValue(attribute.normalizedValue), record);
    }

    for (const reference of record.localizationKeys) {
      appendReference(localizationReferencesByAttributeName, normalizeAttributeName(reference.attribute), {
        record,
        reference,
      });
    }

    for (const reference of record.referencedGuidAttributes ?? []) {
      appendReference(guidReferencesByAttributeName, normalizeAttributeName(reference.attribute), {
        record,
        reference,
      });
    }
  }

  return {
    graph,
    getByRef: (ref) => {
      const recordPath = graph.indexes.byRef[ref.trim()];
      return recordPath ? recordsByPath.get(normalizeGraphPath(recordPath)) : undefined;
    },
    getByPath: (recordPath) => recordsByPath.get(normalizeGraphPath(recordPath)),
    getByRootType: (rootType) => recordsForPaths(graph.indexes.byRootType[rootType] ?? [], recordsByPath),
    getByEntityClass: (entityClass) => recordsForPaths(graph.indexes.byEntityClass[entityClass] ?? [], recordsByPath),
    getByLocalizationKey: (key) =>
      recordsForPaths(graph.indexes.byLocalizationKey[normalizeLocalizationKey(key)] ?? [], recordsByPath),
    getByReferencedGuid: (guid) => recordsForPaths(graph.indexes.byReferencedGuid[guid.trim()] ?? [], recordsByPath),
    getByPathPrefix: (pathPrefix) => {
      const normalizedPrefix = normalizeGraphPath(pathPrefix);
      return graph.records.filter((record) => normalizeGraphPath(record.path).startsWith(normalizedPrefix));
    },
    getByAttributeName: (attributeName) => recordsByAttributeName.get(normalizeAttributeName(attributeName)) ?? [],
    getByAttributeValue: (attributeValue) => recordsByAttributeValue.get(normalizeAttributeValue(attributeValue)) ?? [],
    getLocalizationReferencesByAttributeName: (attributeName) =>
      localizationReferencesByAttributeName.get(normalizeAttributeName(attributeName)) ?? [],
    getGuidReferencesByAttributeName: (attributeName) =>
      guidReferencesByAttributeName.get(normalizeAttributeName(attributeName)) ?? [],
  };
}

function recordsForPaths(paths: string[], recordsByPath: Map<string, DataCoreRecordNode>): DataCoreRecordNode[] {
  return paths.flatMap((recordPath) => {
    const record = recordsByPath.get(normalizeGraphPath(recordPath));
    return record ? [record] : [];
  });
}

function normalizeGraphPath(recordPath: string): string {
  return recordPath.trim().replaceAll('\\', '/');
}

function normalizeLocalizationKey(key: string): string {
  const trimmed = key.trim();
  return trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed;
}

function normalizeAttributeName(attributeName: string): string {
  return attributeName.trim().toLowerCase();
}

function normalizeAttributeValue(attributeValue: string): string {
  const trimmed = attributeValue.trim();
  return trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed;
}

function appendUniqueRecord(
  recordsByKey: Map<string, DataCoreRecordNode[]>,
  key: string,
  record: DataCoreRecordNode,
): void {
  if (!key) return;
  const records = recordsByKey.get(key) ?? [];
  if (!records.some((candidate) => normalizeGraphPath(candidate.path) === normalizeGraphPath(record.path))) {
    records.push(record);
  }
  recordsByKey.set(key, records);
}

function appendReference<T extends DataCoreLocalizationRecordReference | DataCoreGuidRecordReference>(
  referencesByKey: Map<string, T[]>,
  key: string,
  reference: T,
): void {
  if (!key) return;
  const references = referencesByKey.get(key) ?? [];
  references.push(reference);
  referencesByKey.set(key, references);
}
