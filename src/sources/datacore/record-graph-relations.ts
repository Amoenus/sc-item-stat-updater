import {
  hasAnyDataCoreLocalizationKey,
  normalizeDataCoreAttributeName,
  normalizeDataCoreUsableLocalizationKey,
} from './normalization';
import type { DataCoreLocalizationReference, DataCoreRecordNode } from './types';

export function graphLocalizationKey(record: DataCoreRecordNode, attributes: string[]): string {
  return graphLocalizationKeyFromReferences(record.localizationKeys, attributes);
}

export function graphLocalizationKeys(record: DataCoreRecordNode, attributes: string[]): string[] {
  return graphLocalizationKeysFromReferences(record.localizationKeys, attributes);
}

export function hasGraphLocalizationReference(record: DataCoreRecordNode, attributes: string[]): boolean {
  return hasGraphLocalizationReferenceFromReferences(record.localizationKeys, attributes);
}

export function graphLocalizationKeyMatching(
  record: DataCoreRecordNode,
  attributes: string[],
  predicate: (key: string) => boolean,
): string {
  return graphLocalizationKeyFromReferencesMatching(record.localizationKeys, attributes, predicate);
}

export function graphLocalizationKeyWithFallback(
  record: DataCoreRecordNode,
  attributes: string[],
  fallback = '',
): string {
  const graphKey = graphLocalizationKey(record, attributes);
  if (graphKey || hasGraphLocalizationReference(record, attributes)) return graphKey;
  return normalizeDataCoreUsableLocalizationKey(fallback);
}

export function graphLocalizationKeyFromReferences(
  references: DataCoreLocalizationReference[],
  attributes: string[],
): string {
  return graphLocalizationKeyFromReferencesMatching(references, attributes, () => true);
}

export function graphLocalizationKeysFromReferences(
  references: DataCoreLocalizationReference[],
  attributes: string[],
): string[] {
  const keys: string[] = [];
  for (const attribute of attributes) {
    for (const reference of references) {
      if (normalizeDataCoreAttributeName(reference.attribute) !== normalizeDataCoreAttributeName(attribute)) continue;
      const key = normalizeDataCoreUsableLocalizationKey(reference.key);
      if (key && !keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

export function hasGraphLocalizationReferenceFromReferences(
  references: DataCoreLocalizationReference[],
  attributes: string[],
): boolean {
  const expectedAttributes = new Set(attributes.map(normalizeDataCoreAttributeName).filter(Boolean));
  return references.some(
    (reference) =>
      expectedAttributes.has(normalizeDataCoreAttributeName(reference.attribute)) &&
      hasAnyDataCoreLocalizationKey(reference.key),
  );
}

export function graphLocalizationKeyFromReferencesMatching(
  references: DataCoreLocalizationReference[],
  attributes: string[],
  predicate: (key: string) => boolean,
): string {
  for (const attribute of attributes) {
    const key =
      references
        .map((reference) =>
          normalizeDataCoreAttributeName(reference.attribute) === normalizeDataCoreAttributeName(attribute)
            ? normalizeDataCoreUsableLocalizationKey(reference.key)
            : '',
        )
        .find((value) => value && predicate(value)) ?? '';
    if (key) return key;
  }
  return '';
}

export function graphGuidReferences(record: DataCoreRecordNode, attributes: string[]): string[] {
  const expectedAttributes = new Set(attributes.map(normalizeDataCoreAttributeName).filter(Boolean));
  return [
    ...new Set(
      record.referencedGuidAttributes
        ?.filter((reference) => expectedAttributes.has(normalizeDataCoreAttributeName(reference.attribute)))
        .map((reference) => reference.value.trim())
        .filter(Boolean) ?? [],
    ),
  ];
}

export function uniqueGraphGuidReference(record: DataCoreRecordNode, attributes: string[], fallback = ''): string {
  const values = graphGuidReferences(record, attributes);
  if (values.length > 0) return values.length === 1 ? values[0] : '';
  return fallback;
}

export function linkedGraphRecordEntityClass(record: DataCoreRecordNode | undefined): string {
  return record?.entityClass ?? '';
}
