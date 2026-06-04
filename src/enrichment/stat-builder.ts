import { getLogger } from '../infrastructure/logger';
import { fmtNum } from './formatter';

const logger = getLogger('stat-builder');

/**
 * Tracks (label, column) pairs already warned about so a typo in a column
 * name does not produce one warning per row. Reset via {@link resetStatBuilderWarnings}
 * in tests that assert on warning behavior.
 */
const warnedColumns = new Set<string>();

/** Test-only: clears the deduped warning set. */
export function resetStatBuilderWarnings(): void {
  warnedColumns.clear();
}

/**
 * Creates a fluent stat-line builder for constructing INI description values.
 * Lines are joined with \\n (literal backslash-n for INI format).
 *
 * Column references (in `.raw`, `.num`, `.rawIf`, `.numIf`) are checked
 * against the row's known keys at call time. A reference to a column that
 * is not present in the row logs a warning instead of silently producing
 * `undefined` in the output. This catches typos and SPViewer column renames
 * that the per-config `requiredColumns` validation does not cover.
 *
 * @param row Parsed CSV/JSON row
 */
export function stat(row: Record<string, string>) {
  const parts: string[] = [];
  const knownColumns = new Set(Object.keys(row));

  function checkColumn(method: string, label: string, column: string): void {
    if (knownColumns.has(column)) return;
    const dedupeKey = `${method}|${label}|${column}`;
    if (warnedColumns.has(dedupeKey)) return;
    warnedColumns.add(dedupeKey);
    logger.warn('stat-builder: referenced column missing from row', { method, label, column });
  }

  const builder = {
    /** Adds a stat line with a literal value. */
    line(label: string, value: string) {
      parts.push(`${label}: ${value}`);
      return builder;
    },
    /** Adds a stat line with fmtNum() formatting from a CSV column. */
    num(label: string, column: string, suffix = '') {
      checkColumn('num', label, column);
      parts.push(`${label}: ${fmtNum(row[column])}${suffix}`);
      return builder;
    },
    /** Adds a stat line with the raw CSV column value. */
    raw(label: string, column: string, suffix = '') {
      checkColumn('raw', label, column);
      parts.push(`${label}: ${row[column]}${suffix}`);
      return builder;
    },
    /** Adds a section header (preceded by a blank line in the INI output). */
    section(title: string) {
      parts.push(String.raw`\n${title}`);
      return builder;
    },
    /** Adds a stat line only if value is truthy. */
    lineIf(label: string, value: string | undefined) {
      if (value) parts.push(`${label}: ${value}`);
      return builder;
    },
    /** Adds a formatted number line only if the column value exists and is not '0'. */
    numIf(label: string, column: string, suffix = '') {
      checkColumn('numIf', label, column);
      if (row[column] && row[column] !== '0') {
        parts.push(`${label}: ${fmtNum(row[column])}${suffix}`);
      }
      return builder;
    },
    /** Adds a raw value line only if the column value exists and is not '0'. */
    rawIf(label: string, column: string, suffix = '') {
      checkColumn('rawIf', label, column);
      if (row[column] && row[column] !== '0') {
        parts.push(`${label}: ${row[column]}${suffix}`);
      }
      return builder;
    },
    /** Finalizes the stat block, appending flavor text if present. */
    build(flavorText: string) {
      let val = parts.join(String.raw`\n`);
      if (flavorText) val += String.raw`\n\n${flavorText}`;
      return val;
    },
  };

  return builder;
}

export type StatBuilder = ReturnType<typeof stat>;
