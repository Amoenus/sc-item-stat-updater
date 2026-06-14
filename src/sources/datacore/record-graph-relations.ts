import type { DataCoreLocalizationReference, DataCoreRecordNode } from './types';

export function graphLocalizationKey(record: DataCoreRecordNode, attributes: string[]): string {
  return graphLocalizationKeyFromReferences(record.localizationKeys, attributes);
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
  for (const attribute of attributes) {
    const key =
      references
        .find(
          (reference) =>
            reference.attribute.trim().toLowerCase() === attribute.trim().toLowerCase() &&
            isUsableLocalizationKey(reference.key),
        )
        ?.key.trim() ?? '';
    if (key) return key.startsWith('@') ? key.slice(1).trim() : key;
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

function isUsableLocalizationKey(value: string | undefined): boolean {
  const normalized = normalizeLocalizationKey(value ?? '');
  return normalized !== '' && !/^LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i.test(normalized);
}

function normalizeGraphAttributeName(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeLocalizationKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^@?LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i.test(trimmed)) return '';
  return trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed;
}
