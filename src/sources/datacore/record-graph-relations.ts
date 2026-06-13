import type { DataCoreRecordNode } from './types';

export function uniqueGraphGuidReference(
  record: DataCoreRecordNode,
  attributes: string[],
  fallback = '',
): string {
  const expectedAttributes = new Set(attributes.map((attribute) => attribute.toLowerCase()));
  const values = [
    ...new Set(
      record.referencedGuidAttributes
        ?.filter((reference) => expectedAttributes.has(reference.attribute.toLowerCase()))
        .map((reference) => reference.value.trim())
        .filter(Boolean) ?? [],
    ),
  ];
  return values.length === 1 ? values[0] : fallback;
}
