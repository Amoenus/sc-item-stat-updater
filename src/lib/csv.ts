import { stringify } from 'csv-stringify/sync';

export function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
  return stringify(rows, {
    header: true,
    columns: headers.map((h) => ({ key: h, header: h })),
    cast: {
      object: (value) => (value === null ? '' : JSON.stringify(value)),
    },
  });
}
