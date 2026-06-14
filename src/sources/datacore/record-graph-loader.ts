import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveChildPath } from '../../io/local/path-conventions';
import {
  appendMapValue,
  appendUniqueRecord,
  normalizeDataCoreAttributeName,
  normalizeDataCoreAttributeValue,
  normalizeDataCoreGraphPath,
  stripDataCoreLocalizationPrefix,
} from './normalization';
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
    recordsByPath.set(normalizeDataCoreGraphPath(record.path), record);

    for (const attribute of record.attributes ?? []) {
      appendUniqueRecord(recordsByAttributeName, normalizeDataCoreAttributeName(attribute.attribute), record);
      appendUniqueRecord(recordsByAttributeValue, normalizeDataCoreAttributeValue(attribute.rawValue), record);
      appendUniqueRecord(recordsByAttributeValue, normalizeDataCoreAttributeValue(attribute.normalizedValue), record);
    }

    for (const reference of record.localizationKeys) {
      appendMapValue(localizationReferencesByAttributeName, normalizeDataCoreAttributeName(reference.attribute), {
        record,
        reference,
      });
    }

    for (const reference of record.referencedGuidAttributes ?? []) {
      appendMapValue(guidReferencesByAttributeName, normalizeDataCoreAttributeName(reference.attribute), {
        record,
        reference,
      });
    }
  }

  return {
    graph,
    getByRef: (ref) => {
      const recordPath = graph.indexes.byRef[ref.trim()];
      return recordPath ? recordsByPath.get(normalizeDataCoreGraphPath(recordPath)) : undefined;
    },
    getByPath: (recordPath) => recordsByPath.get(normalizeDataCoreGraphPath(recordPath)),
    getByRootType: (rootType) => recordsForPaths(graph.indexes.byRootType[rootType] ?? [], recordsByPath),
    getByEntityClass: (entityClass) => recordsForPaths(graph.indexes.byEntityClass[entityClass] ?? [], recordsByPath),
    getByLocalizationKey: (key) =>
      recordsForPaths(graph.indexes.byLocalizationKey[stripDataCoreLocalizationPrefix(key)] ?? [], recordsByPath),
    getByReferencedGuid: (guid) => recordsForPaths(graph.indexes.byReferencedGuid[guid.trim()] ?? [], recordsByPath),
    getByPathPrefix: (pathPrefix) => {
      const normalizedPrefix = normalizeDataCoreGraphPath(pathPrefix);
      return graph.records.filter((record) => normalizeDataCoreGraphPath(record.path).startsWith(normalizedPrefix));
    },
    getByAttributeName: (attributeName) =>
      recordsByAttributeName.get(normalizeDataCoreAttributeName(attributeName)) ?? [],
    getByAttributeValue: (attributeValue) =>
      recordsByAttributeValue.get(normalizeDataCoreAttributeValue(attributeValue)) ?? [],
    getLocalizationReferencesByAttributeName: (attributeName) =>
      localizationReferencesByAttributeName.get(normalizeDataCoreAttributeName(attributeName)) ?? [],
    getGuidReferencesByAttributeName: (attributeName) =>
      guidReferencesByAttributeName.get(normalizeDataCoreAttributeName(attributeName)) ?? [],
  };
}

function recordsForPaths(paths: string[], recordsByPath: Map<string, DataCoreRecordNode>): DataCoreRecordNode[] {
  return paths.flatMap((recordPath) => {
    const record = recordsByPath.get(normalizeDataCoreGraphPath(recordPath));
    return record ? [record] : [];
  });
}
