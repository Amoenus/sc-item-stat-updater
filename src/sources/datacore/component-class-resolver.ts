import type { DataCoreRecordGraphLookup } from './types';

export const NON_DISPLAY_COMPONENT_CLASSES = new Set([
  '',
  'BASIC',
  'UNDEFINED',
  'COOLER',
  'POWER',
  'QUANTUMDRIVE',
  'RADAR',
  'SHIELD',
]);

const HAULING_COMPONENT_CLASS_PATTERN =
  /^HaulingEntityClass_(?<type>Cooler|JumpDrive|PowerPlant|QuantumDrive|Radar|ShieldGenerator)_S\d+_(?<class>Civilian|Commercial|Competition|Industrial|Military|Stealth)$/i;

export function buildDataCoreHaulingComponentClassLookup(
  graph: DataCoreRecordGraphLookup | null | undefined,
): Map<string, string> {
  const entityClassToHaulingClass = new Map<string, string>();

  if (!graph) {
    return entityClassToHaulingClass;
  }

  for (const record of graph.getByRootType('Hauling_EntityClasses')) {
    const haulingClass = getHaulingComponentClass(record.entityClass);
    if (!haulingClass) continue;

    for (const ref of record.referencedGuids) {
      const componentRecord = graph.getByRef(ref);
      if (!componentRecord?.entityClass) continue;
      const entityClass = normalizeDataCoreEntityClass(componentRecord.entityClass);
      if (entityClass) {
        entityClassToHaulingClass.set(entityClass, haulingClass);
      }
    }
  }

  return entityClassToHaulingClass;
}

export function resolveDataCoreComponentClass(
  rawClass: string,
  entityClass: string,
  entityClassToHaulingClass: Map<string, string>,
): string {
  const normalizedRawClass = normalizeSpaces(rawClass);
  if (isDisplayDataCoreComponentClass(normalizedRawClass)) {
    return normalizedRawClass;
  }

  return entityClassToHaulingClass.get(normalizeDataCoreEntityClass(entityClass)) ?? '';
}

export function isDisplayDataCoreComponentClass(value: string): boolean {
  return !NON_DISPLAY_COMPONENT_CLASSES.has(normalizeSpaces(value).toUpperCase());
}

export function normalizeDataCoreEntityClass(value: unknown): string {
  return normalizeSpaces(value).replace(/_SCItem$/i, '').toLowerCase();
}

export function normalizeSpaces(value: unknown): string {
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

function getHaulingComponentClass(entityClass: string): string {
  const match = HAULING_COMPONENT_CLASS_PATTERN.exec(entityClass);
  return match?.groups?.class ?? '';
}
