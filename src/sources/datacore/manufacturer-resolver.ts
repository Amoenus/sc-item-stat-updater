import type { DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { graphLocalizationKey } from './record-graph-relations';

export interface DataCoreManufacturer {
  ref: string;
  path: string;
  code: string;
  entityClass: string;
  nameKey: string;
  descriptionKey: string;
  record: DataCoreRecordNode;
}

export interface DataCoreManufacturerResolver {
  all(): DataCoreManufacturer[];
  getByRef(ref: string): DataCoreManufacturer | undefined;
  getByCode(code: string): DataCoreManufacturer | undefined;
  getByNameLocalizationKey(key: string): DataCoreManufacturer | undefined;
  getByDescriptionLocalizationKey(key: string): DataCoreManufacturer | undefined;
  resolve(value: string): DataCoreManufacturer | undefined;
}

export function createDataCoreManufacturerResolver(graph: DataCoreRecordGraphLookup): DataCoreManufacturerResolver {
  const manufacturers = graph.getByRootType('SCItemManufacturer').map(toManufacturer);
  const byRef = new Map<string, DataCoreManufacturer>();
  const byCode = new Map<string, DataCoreManufacturer>();
  const byNameKey = new Map<string, DataCoreManufacturer>();
  const byDescriptionKey = new Map<string, DataCoreManufacturer>();

  for (const manufacturer of manufacturers) {
    addFirst(byRef, normalizeExact(manufacturer.ref), manufacturer);
    addFirst(byCode, normalizeCode(manufacturer.code), manufacturer);
    addFirst(byCode, normalizeCode(manufacturer.entityClass), manufacturer);
    addFirst(byNameKey, normalizeLocalizationKey(manufacturer.nameKey), manufacturer);
    addFirst(byDescriptionKey, normalizeLocalizationKey(manufacturer.descriptionKey), manufacturer);
  }

  return {
    all: () => [...manufacturers],
    getByRef: (ref) => byRef.get(normalizeExact(ref)),
    getByCode: (code) => byCode.get(normalizeCode(code)),
    getByNameLocalizationKey: (key) => byNameKey.get(normalizeLocalizationKey(key)),
    getByDescriptionLocalizationKey: (key) => byDescriptionKey.get(normalizeLocalizationKey(key)),
    resolve: (value) => {
      const exact = normalizeExact(value);
      return (
        byRef.get(exact) ??
        byCode.get(normalizeCode(value)) ??
        byNameKey.get(normalizeLocalizationKey(value)) ??
        byDescriptionKey.get(normalizeLocalizationKey(value))
      );
    },
  };
}

function toManufacturer(record: DataCoreRecordNode): DataCoreManufacturer {
  const nameKey = graphLocalizationKey(record, ['Name', 'name', 'displayName']);
  const descriptionKey = graphLocalizationKey(record, ['Description', 'description', 'displayDescription']);

  return {
    ref: record.ref,
    path: record.path,
    code: record.entityClass,
    entityClass: record.entityClass,
    nameKey,
    descriptionKey,
    record,
  };
}

function addFirst(index: Map<string, DataCoreManufacturer>, key: string, manufacturer: DataCoreManufacturer): void {
  if (!key || index.has(key)) return;
  index.set(key, manufacturer);
}

function normalizeExact(value: string): string {
  return value.trim();
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeLocalizationKey(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed;
}
