import type { DataCoreRecordNode } from './types';

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
