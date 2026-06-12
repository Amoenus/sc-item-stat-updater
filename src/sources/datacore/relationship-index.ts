import type { DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';

export interface DataCoreRelationshipIndex {
  getRecordForEntityClass(entityClass: string): DataCoreRecordNode | undefined;
  getLocalizationKeysForRecord(record: DataCoreRecordNode | undefined): string[];
  getReferencedRecords(record: DataCoreRecordNode | undefined): DataCoreRecordNode[];
  getReferencingRecords(record: DataCoreRecordNode | undefined): DataCoreRecordNode[];
}

export function createDataCoreRelationshipIndex(
  graph: DataCoreRecordGraphLookup | null | undefined,
): DataCoreRelationshipIndex {
  const normalizedEntityClassToRecord = new Map<string, DataCoreRecordNode>();

  for (const record of graph?.graph.records ?? []) {
    const entityClass = normalizeDataCoreRelationshipEntityClass(record.entityClass);
    if (entityClass && !normalizedEntityClassToRecord.has(entityClass)) {
      normalizedEntityClassToRecord.set(entityClass, record);
    }
  }

  return {
    getRecordForEntityClass(entityClass) {
      return normalizedEntityClassToRecord.get(normalizeDataCoreRelationshipEntityClass(entityClass));
    },
    getLocalizationKeysForRecord(record) {
      return uniqueSorted(
        (record?.localizationKeys ?? [])
          .map(({ key }) => normalizeDataCoreRelationshipLocalizationKey(key))
          .filter((key) => key !== ''),
      );
    },
    getReferencedRecords(record) {
      if (!graph || !record) return [];
      return uniqueRecords(record.referencedGuids.flatMap((ref) => graph.getByRef(ref) ?? []));
    },
    getReferencingRecords(record) {
      if (!graph || !record?.ref) return [];
      return uniqueRecords(graph.getByReferencedGuid(record.ref));
    },
  };
}

export function normalizeDataCoreRelationshipEntityClass(value: unknown): string {
  return normalizeSpaces(value).replace(/_SCItem$/i, '').toLowerCase();
}

export function normalizeDataCoreRelationshipLocalizationKey(value: unknown): string {
  return normalizeSpaces(value).replace(/^@/, '').toLowerCase();
}

function uniqueRecords(records: DataCoreRecordNode[]): DataCoreRecordNode[] {
  const seen = new Set<string>();
  const unique: DataCoreRecordNode[] = [];

  for (const record of records) {
    const key = record.path || record.ref;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(record);
  }

  return unique;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function normalizeSpaces(value: unknown): string {
  let str: string;
  if (value == null) {
    str = '';
  } else if (typeof value === 'string') {
    str = value;
  } else {
    str = JSON.stringify(value);
  }
  return str.replaceAll(/[\u00a0\u202f]/g, ' ').replaceAll(/\s+/g, ' ').trim();
}
