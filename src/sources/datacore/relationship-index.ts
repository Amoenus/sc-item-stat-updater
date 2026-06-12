import type { DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';

export interface DataCoreRelationshipIndex {
  getRecordForEntityClass(entityClass: string): DataCoreRecordNode | undefined;
  getRecordsByRootType(rootType: string): DataCoreRecordNode[];
  getRecordsByLocalizationKey(localizationKey: string): DataCoreRecordNode[];
  getRecordsReferencingEntityClass(entityClass: string): DataCoreRecordNode[];
  getLocalizationKeysForRecord(record: DataCoreRecordNode | undefined): string[];
  getReferencedRecords(record: DataCoreRecordNode | undefined): DataCoreRecordNode[];
  getReferencingRecords(record: DataCoreRecordNode | undefined): DataCoreRecordNode[];
  getRelationshipSummary(): DataCoreRelationshipSummary;
}

export interface DataCoreRelationshipSummary {
  totalRecords: number;
  recordsWithLocalizationKeys: number;
  localizationKeyReferences: number;
  referencedGuidReferences: number;
  inboundReferenceTargets: number;
  rootTypes: Record<string, number>;
}

export function createDataCoreRelationshipIndex(
  graph: DataCoreRecordGraphLookup | null | undefined,
): DataCoreRelationshipIndex {
  const normalizedEntityClassToRecord = new Map<string, DataCoreRecordNode>();
  const rootTypeToRecords = new Map<string, DataCoreRecordNode[]>();
  const normalizedLocalizationKeyToRecords = new Map<string, DataCoreRecordNode[]>();

  for (const record of graph?.graph.records ?? []) {
    const entityClass = normalizeDataCoreRelationshipEntityClass(record.entityClass);
    if (entityClass && !normalizedEntityClassToRecord.has(entityClass)) {
      normalizedEntityClassToRecord.set(entityClass, record);
    }

    const rootType = normalizeSpaces(record.rootType);
    if (rootType) appendRecord(rootTypeToRecords, rootType, record);

    for (const { key } of record.localizationKeys) {
      const localizationKey = normalizeDataCoreRelationshipLocalizationKey(key);
      if (localizationKey) appendRecord(normalizedLocalizationKeyToRecords, localizationKey, record);
    }
  }

  return {
    getRecordForEntityClass(entityClass) {
      return normalizedEntityClassToRecord.get(normalizeDataCoreRelationshipEntityClass(entityClass));
    },
    getRecordsByRootType(rootType) {
      return uniqueRecords(rootTypeToRecords.get(normalizeSpaces(rootType)) ?? []);
    },
    getRecordsByLocalizationKey(localizationKey) {
      return uniqueRecords(
        normalizedLocalizationKeyToRecords.get(normalizeDataCoreRelationshipLocalizationKey(localizationKey)) ?? [],
      );
    },
    getRecordsReferencingEntityClass(entityClass) {
      return this.getReferencingRecords(this.getRecordForEntityClass(entityClass));
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
    getRelationshipSummary() {
      return {
        totalRecords: graph?.graph.recordCount ?? 0,
        recordsWithLocalizationKeys: (graph?.graph.records ?? []).filter((record) => record.localizationKeys.length > 0)
          .length,
        localizationKeyReferences: (graph?.graph.records ?? []).reduce(
          (sum, record) => sum + record.localizationKeys.length,
          0,
        ),
        referencedGuidReferences: (graph?.graph.records ?? []).reduce(
          (sum, record) => sum + record.referencedGuids.length,
          0,
        ),
        inboundReferenceTargets: graph ? Object.keys(graph.graph.indexes.byReferencedGuid).length : 0,
        rootTypes: Object.fromEntries(
          [...rootTypeToRecords.entries()].map(([rootType, records]) => [rootType, records.length]),
        ),
      };
    },
  };
}

export function normalizeDataCoreRelationshipEntityClass(value: unknown): string {
  return normalizeSpaces(value)
    .replace(/_SCItem$/i, '')
    .toLowerCase();
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

function appendRecord(recordsByKey: Map<string, DataCoreRecordNode[]>, key: string, record: DataCoreRecordNode): void {
  const records = recordsByKey.get(key) ?? [];
  records.push(record);
  recordsByKey.set(key, records);
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
  return str
    .replaceAll(/[\u00a0\u202f]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}
