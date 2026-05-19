import { fmtNum } from './formatter';

/**
 * Creates a fluent stat-line builder for constructing INI description values.
 * Lines are joined with \\n (literal backslash-n for INI format).
 *
 * @param {Record<string, string>} row - Parsed CSV row
 */
export function stat(row: Record<string, string>) {
  const parts: string[] = [];

  const builder = {
    /** Adds a stat line with a literal value. */
    line(label: string, value: string) {
      parts.push(`${label}: ${value}`);
      return builder;
    },
    /** Adds a stat line with fmtNum() formatting from a CSV column. */
    num(label: string, column: string, suffix = '') {
      parts.push(`${label}: ${fmtNum(row[column])}${suffix}`);
      return builder;
    },
    /** Adds a stat line with the raw CSV column value. */
    raw(label: string, column: string, suffix = '') {
      parts.push(`${label}: ${row[column]}${suffix}`);
      return builder;
    },
    /** Adds a section header (preceded by a blank line in the INI output). */
    section(title: string) {
      parts.push(`\\n${title}`);
      return builder;
    },
    /** Adds a stat line only if value is truthy. */
    lineIf(label: string, value: string | undefined) {
      if (value) parts.push(`${label}: ${value}`);
      return builder;
    },
    /** Adds a formatted number line only if the column value exists and is not '0'. */
    numIf(label: string, column: string, suffix = '') {
      if (row[column] && row[column] !== '0') {
        parts.push(`${label}: ${fmtNum(row[column])}${suffix}`);
      }
      return builder;
    },
    /** Adds a raw value line only if the column value exists and is not '0'. */
    rawIf(label: string, column: string, suffix = '') {
      if (row[column] && row[column] !== '0') {
        parts.push(`${label}: ${row[column]}${suffix}`);
      }
      return builder;
    },
    /** Finalizes the stat block, appending flavor text if present. */
    build(flavorText: string) {
      let val = parts.join('\\n');
      if (flavorText) val += `\\n\\n${flavorText}`;
      return val;
    },
  };

  return builder;
}
