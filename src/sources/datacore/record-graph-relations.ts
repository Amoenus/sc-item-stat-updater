import type { DataCoreRecordNode } from './types';

export function graphLocalizationKey(record: DataCoreRecordNode, attributes: string[]): string {
  for (const attribute of attributes) {
    const key =
      record.localizationKeys
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
  const expectedAttributes = new Set(attributes.map((attribute) => attribute.toLowerCase()));
  return [
    ...new Set(
      record.referencedGuidAttributes
        ?.filter((reference) => expectedAttributes.has(reference.attribute.toLowerCase()))
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
  const normalized = value?.trim().replace(/^@/, '').trim() ?? '';
  return normalized !== '' && !/^LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i.test(normalized);
}
