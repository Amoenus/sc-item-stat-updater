import type { DataCoreRecordNode } from './types';

const PLACEHOLDER_LOCALIZATION_KEY_PATTERN = /^LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i;
const FULL_GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeDataCoreSpaces(value: unknown): string {
  let str: string;
  if (value == null) {
    str = '';
  } else if (typeof value === 'string') {
    str = value;
  } else {
    str = JSON.stringify(value);
  }
  return str
    .replaceAll(/[\u00a0\u202f]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

export function normalizeDataCoreGraphPath(recordPath: string): string {
  return recordPath.trim().replaceAll('\\', '/');
}

export function normalizeDataCoreAttributeName(attributeName: string): string {
  return normalizeDataCoreSpaces(attributeName).toLowerCase();
}

export function normalizeDataCoreAttributeValue(attributeValue: string): string {
  const value = stripDataCoreLocalizationPrefix(attributeValue);
  return FULL_GUID_PATTERN.test(value) ? value.toLowerCase() : value;
}

export function stripDataCoreLocalizationPrefix(value: unknown): string {
  const trimmed = normalizeDataCoreSpaces(value);
  return trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed;
}

export function normalizeDataCoreLookupKey(value: unknown): string {
  return stripDataCoreLocalizationPrefix(value).toLowerCase();
}

export function normalizeDataCoreUsableLocalizationKey(value: unknown): string {
  const key = stripDataCoreLocalizationPrefix(value);
  return key && !PLACEHOLDER_LOCALIZATION_KEY_PATTERN.test(key) ? key : '';
}

export function isUsableDataCoreLocalizationKey(value: unknown): boolean {
  return normalizeDataCoreUsableLocalizationKey(value) !== '';
}

export function hasAnyDataCoreLocalizationKey(value: unknown): boolean {
  return stripDataCoreLocalizationPrefix(value) !== '';
}

export function uniqueSortedStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function uniqueDataCoreRecords(records: DataCoreRecordNode[]): DataCoreRecordNode[] {
  const seen = new Set<string>();
  const unique: DataCoreRecordNode[] = [];

  for (const record of records) {
    const key = normalizeDataCoreGraphPath(record.path) || record.ref;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(record);
  }

  return unique;
}

export function appendMapValue<T>(valuesByKey: Map<string, T[]>, key: string, value: T): void {
  if (!key) return;
  const values = valuesByKey.get(key) ?? [];
  values.push(value);
  valuesByKey.set(key, values);
}

export function appendUniqueRecord(
  recordsByKey: Map<string, DataCoreRecordNode[]>,
  key: string,
  record: DataCoreRecordNode,
): void {
  if (!key) return;
  const records = recordsByKey.get(key) ?? [];
  if (
    !records.some((candidate) => normalizeDataCoreGraphPath(candidate.path) === normalizeDataCoreGraphPath(record.path))
  ) {
    records.push(record);
  }
  recordsByKey.set(key, records);
}
