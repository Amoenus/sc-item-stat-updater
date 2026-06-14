import type { DataCoreLocalizationReference, DataCoreRecordNode } from './types';

export function graphLocalizationKey(record: DataCoreRecordNode, attributes: string[]): string {
  return graphLocalizationKeyFromReferences(record.localizationKeys, attributes);
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
  return graphLocalizationKey(record, attributes) || normalizeLocalizationKey(fallback);
}

export function graphLocalizationKeyFromReferences(
  references: DataCoreLocalizationReference[],
  attributes: string[],
): string {
  return graphLocalizationKeyFromReferencesMatching(references, attributes, () => true);
}

export function hasGraphLocalizationReferenceFromReferences(
  references: DataCoreLocalizationReference[],
  attributes: string[],
): boolean {
  const expectedAttributes = new Set(attributes.map(normalizeGraphAttributeName).filter(Boolean));
  return references.some(
    (reference) =>
      expectedAttributes.has(normalizeGraphAttributeName(reference.attribute)) && hasAnyLocalizationKey(reference.key),
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
          reference.attribute.trim().toLowerCase() === attribute.trim().toLowerCase()
            ? normalizeLocalizationKey(reference.key)
            : '',
        )
        .find((value) => value && predicate(value)) ?? '';
    if (key) return key;
  }
  return '';
}

export function graphGuidReferences(record: DataCoreRecordNode, attributes: string[]): string[] {
  const expectedAttributes = new Set(attributes.map(normalizeGraphAttributeName).filter(Boolean));
  return [
    ...new Set(
      record.referencedGuidAttributes
        ?.filter((reference) => expectedAttributes.has(normalizeGraphAttributeName(reference.attribute)))
        .map((reference) => reference.value.trim())
        .filter(Boolean) ?? [],
    ),
  ];
}

export function uniqueGraphGuidReference(
  record: DataCoreRecordNode,
  attributes: string[],
  fallback = '',
): string {
  const values = graphGuidReferences(record, attributes);
  return values.length === 1 ? values[0] : fallback;
}

function normalizeGraphAttributeName(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeLocalizationKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^@?LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i.test(trimmed)) return '';
  return trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed;
}

function hasAnyLocalizationKey(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith('@') ? trimmed.slice(1).trim() !== '' : trimmed !== '';
}
