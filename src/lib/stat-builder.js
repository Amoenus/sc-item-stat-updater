import { fmtNum } from './formatter.js';

export { fmtNum };

/**
 * Creates a fluent stat-line builder for constructing INI description values.
 * Lines are joined with \\n (literal backslash-n for INI format).
 *
 * @param {Record<string, string>} row - Parsed CSV row
 */
export function stat(row) {
  /** @type {string[]} */
  const parts = [];

  const builder = {
    /** Adds a stat line with a literal value. */
    line(label, value) {
      parts.push(`${label}: ${value}`);
      return builder;
    },
    /** Adds a stat line with fmtNum() formatting from a CSV column. */
    num(label, column, suffix = '') {
      parts.push(`${label}: ${fmtNum(row[column])}${suffix}`);
      return builder;
    },
    /** Adds a stat line with the raw CSV column value. */
    raw(label, column, suffix = '') {
      parts.push(`${label}: ${row[column]}${suffix}`);
      return builder;
    },
    /** Adds a section header (preceded by a blank line in the INI output). */
    section(title) {
      parts.push(`\\n${title}`);
      return builder;
    },
    /** Adds a stat line only if value is truthy. */
    lineIf(label, value) {
      if (value) parts.push(`${label}: ${value}`);
      return builder;
    },
    /** Adds a formatted number line only if the column value exists and is not '0'. */
    numIf(label, column, suffix = '') {
      if (row[column] && row[column] !== '0') {
        parts.push(`${label}: ${fmtNum(row[column])}${suffix}`);
      }
      return builder;
    },
    /** Adds a raw value line only if the column value exists and is not '0'. */
    rawIf(label, column, suffix = '') {
      if (row[column] && row[column] !== '0') {
        parts.push(`${label}: ${row[column]}${suffix}`);
      }
      return builder;
    },
    /** Finalizes the stat block, appending flavor text if present. */
    build(flavorText) {
      let val = parts.join('\\n');
      if (flavorText) val += `\\n\\n${flavorText}`;
      return val;
    },
  };

  return builder;
}
