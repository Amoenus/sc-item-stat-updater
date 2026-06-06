/**
 * Builds a Map from row data using a row-to-entry projector.
 * Nullish projector results are skipped.
 */
export function buildLookupMapFromRows<V>(
  rows: Iterable<Record<string, string>>,
  buildEntry: (row: Record<string, string>) => null | undefined | readonly [string, V],
): Map<string, V> {
  const lookup = new Map();
  for (const row of rows) {
    const entry = buildEntry(row);
    if (!entry) {
      continue;
    }
    lookup.set(entry[0], entry[1]);
  }
  return lookup;
}
