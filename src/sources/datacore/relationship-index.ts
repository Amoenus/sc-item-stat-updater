import {
  appendMapValue,
  isUsableDataCoreLocalizationKey,
  normalizeDataCoreLookupKey,
  normalizeDataCoreSpaces,
  uniqueDataCoreRecords,
  uniqueSortedStrings,
} from './normalization';
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

    const rootType = normalizeDataCoreSpaces(record.rootType);
    if (rootType) appendMapValue(rootTypeToRecords, rootType, record);

    for (const { key } of record.localizationKeys) {
      if (!isUsableDataCoreLocalizationKey(key)) continue;
      const localizationKey = normalizeDataCoreRelationshipLocalizationKey(key);
      if (localizationKey) appendMapValue(normalizedLocalizationKeyToRecords, localizationKey, record);
    }
  }

  return {
    getRecordForEntityClass(entityClass) {
      return normalizedEntityClassToRecord.get(normalizeDataCoreRelationshipEntityClass(entityClass));
    },
    getRecordsByRootType(rootType) {
      return uniqueDataCoreRecords(rootTypeToRecords.get(normalizeDataCoreSpaces(rootType)) ?? []);
    },
    getRecordsByLocalizationKey(localizationKey) {
      return uniqueDataCoreRecords(
        normalizedLocalizationKeyToRecords.get(normalizeDataCoreRelationshipLocalizationKey(localizationKey)) ?? [],
      );
    },
    getRecordsReferencingEntityClass(entityClass) {
      return this.getReferencingRecords(this.getRecordForEntityClass(entityClass));
    },
    getLocalizationKeysForRecord(record) {
      return uniqueSortedStrings(
        (record?.localizationKeys ?? [])
          .filter(({ key }) => isUsableDataCoreLocalizationKey(key))
          .map(({ key }) => normalizeDataCoreRelationshipLocalizationKey(key))
          .filter((key) => key !== ''),
      );
    },
    getReferencedRecords(record) {
      if (!graph || !record) return [];
      return uniqueDataCoreRecords(record.referencedGuids.flatMap((ref) => graph.getByRef(ref) ?? []));
    },
    getReferencingRecords(record) {
      if (!graph || !record?.ref) return [];
      return uniqueDataCoreRecords(graph.getByReferencedGuid(record.ref));
    },
    getRelationshipSummary() {
      return {
        totalRecords: graph?.graph.recordCount ?? 0,
        recordsWithLocalizationKeys: (graph?.graph.records ?? []).filter((record) =>
          record.localizationKeys.some(({ key }) => isUsableDataCoreLocalizationKey(key)),
        ).length,
        localizationKeyReferences: (graph?.graph.records ?? []).reduce(
          (sum, record) =>
            sum + record.localizationKeys.filter(({ key }) => isUsableDataCoreLocalizationKey(key)).length,
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
  return normalizeDataCoreSpaces(value)
    .replace(/_SCItem$/i, '')
    .toLowerCase();
}

export function normalizeDataCoreRelationshipLocalizationKey(value: unknown): string {
  return normalizeDataCoreLookupKey(value);
}
