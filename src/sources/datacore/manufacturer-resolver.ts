import type { DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';

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

function graphLocalizationKey(record: DataCoreRecordNode, attributes: string[]): string {
  const expectedAttributes = new Set(attributes.map((attribute) => attribute.toLowerCase()));
  return (
    record.localizationKeys.find(
      (reference) =>
        expectedAttributes.has(reference.attribute.toLowerCase()) && isUsableLocalizationKey(reference.key),
    )?.key ?? ''
  );
}

function isUsableLocalizationKey(value: string): boolean {
  const normalized = normalizeLocalizationKey(value);
  return normalized !== '' && !/^LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i.test(normalized);
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
