export function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const escapeCsv = (value: unknown): string => {
    if (value === undefined || value === null) return '';
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  };
  const lines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row: Record<string, unknown>) => headers.map((col: string) => escapeCsv(row[col])).join(',')),
  ];
  return `${lines.join('\n')}\n`;
}
