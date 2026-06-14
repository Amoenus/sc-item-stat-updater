import { uniqueDataCoreRecords } from './normalization';
import type { DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';

export interface QueryDataCoreRecordsOptions {
  pathPrefix: string;
  rootType?: string;
  rootTypes?: readonly string[];
  predicate?: (record: DataCoreRecordNode) => boolean;
  unique?: boolean;
}

export function queryDataCoreRecords(
  graph: DataCoreRecordGraphLookup,
  options: QueryDataCoreRecordsOptions,
): DataCoreRecordNode[] {
  const rootTypes = new Set([...(options.rootType ? [options.rootType] : []), ...(options.rootTypes ?? [])]);
  const records = graph
    .getByPathPrefix(options.pathPrefix)
    .filter((record) => rootTypes.size === 0 || rootTypes.has(record.rootType))
    .filter((record) => options.predicate?.(record) ?? true);

  return (options.unique ? uniqueDataCoreRecords(records) : records).sort((a, b) => a.path.localeCompare(b.path));
}
