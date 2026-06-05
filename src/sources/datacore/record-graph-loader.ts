import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveChildPath } from '../../io/local/path-conventions';
import type { DataCoreRecordGraph, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';

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
  for (const record of graph.records) {
    recordsByPath.set(normalizeGraphPath(record.path), record);
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
