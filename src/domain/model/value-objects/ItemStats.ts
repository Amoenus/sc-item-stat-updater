import { getLogger } from '../../../../src/lib/logger';

const logger = getLogger('item-stats');

/**
 * Value Object representing Star Citizen item statistics
 * Immutable collection of stat lines that can be formatted for INI output
 */
export class ItemStats {
  private readonly lines: string[];

  /**
   * Private constructor - use ItemStats.create() to get a builder
   * @param lines Array of stat lines (label: value format)
   */
  private constructor(lines: string[]) {
    this.lines = [...lines]; // Immutable copy
  }

  /**
   * Creates a new ItemStatsBuilder for fluent construction
   * @returns ItemStatsBuilder
   */
  static create(): ItemStatsBuilder {
    return new ItemStatsBuilder();
  }

  /**
   * Creates ItemStats from existing lines (for reconstruction)
   * @param lines Array of stat lines
   * @returns ItemStats
   */
  static fromLines(lines: string[]): ItemStats {
    return new ItemStats(lines);
  }

  /**
   * Adds a stat line with label and value
   * @param label Stat label (e.g., "Damage", "Cooling Rate")
   * @param value Stat value (will be converted to string)
   * @returns New ItemStats instance with added line
   */
  addLine(label: string, value: string | number): ItemStats {
    const stringValue = typeof value === 'number' ? value.toString() : value;
    const newLines = [...this.lines, `${label}: ${stringValue}`];
    return new ItemStats(newLines);
  }

  /**
   * Adds a section header (preceded by blank line in INI output)
   * @param title Section title
   * @returns New ItemStats instance with section header
   */
  section(title: string): ItemStats {
    const newLines = [...this.lines, '', title];
    return new ItemStats(newLines);
  }

  /**
   * Adds a stat line only if value is truthy (not null, undefined, empty, or zero)
   * @param label Stat label
   * @param value Stat value to check
   * @returns New ItemStats instance with conditionally added line
   */
  addLineIf(label: string, value: string | number | null | undefined): ItemStats {
    if (value === null || value === undefined || value === '' || value === 0) {
      return this; // Return unchanged if falsy
    }
    const stringValue = typeof value === 'number' ? value.toString() : value;
    const newLines = [...this.lines, `${label}: ${stringValue}`];
    return new ItemStats(newLines);
  }

  /**
   * Builds the final string representation for INI output
   * @param flavorText Optional flavor text to append
   * @returns Formatted string ready for INI description field
   */
  build(flavorText?: string): string {
    let result = this.lines.join('\n');
    if (flavorText) {
      result += `\n\n${flavorText}`;
    }
    return result;
  }

  /**
   * Returns the string representation (same as build())
   */
  toString(): string {
    return this.build();
  }

  /**
   * Gets the raw lines array (copy to maintain immutability)
   * @returns Copy of internal lines array
   */
  getLines(): string[] {
    return [...this.lines];
  }

  /**
   * Checks if stats have any lines
   * @returns true if contains stat lines
   */
  isEmpty(): boolean {
    return this.lines.length === 0;
  }

  /**
   * Gets number of stat lines
   * @returns Count of lines
   */
  size(): number {
    return this.lines.length;
  }

  /**
   * Creates ItemStats from CSV row using the existing stat-builder logic
   * This maintains backward compatibility during migration
   * @param row Parsed CSV/JSON row
   * @returns ItemStatsBuilder for chaining
   */
  static fromRow(row: Record<string, string>): ItemStatsBuilder {
    return new ItemStatsBuilder(row);
  }
}

/**
 * Builder for ItemStats - allows fluent construction
 * Internal implementation similar to existing stat() function but returns proper VO
 */
export class ItemStatsBuilder {
  private lines: string[] = [];
  private warnedColumns = new Set<string>();
  private readonly knownColumns: Set<string>;
  private row: Record<string, string> | undefined;

  /**
   * @param row Parsed CSV/JSON row for column validation
   */
  constructor(row?: Record<string, string>) {
    this.row = row;
    this.knownColumns = row ? new Set(Object.keys(row)) : new Set();
  }

  /**
   * Checks if column exists in row and logs warning if missing (deduplicated)
   * @param method Method name for logging
   * @param label Label for logging
   * @param column Column name to check
   */
  private checkColumn(method: string, label: string, column: string): void {
    if (!this.row || !this.knownColumns.has(column)) {
      const dedupeKey = `${method}|${label}|${column}`;
      if (this.warnedColumns.has(dedupeKey)) return;
      this.warnedColumns.add(dedupeKey);
      logger.warn('item-stats-builder: referenced column missing from row', { method, label, column });
    }
  }

  /** Adds a stat line with a literal value. */
  line(label: string, value: string): this {
    this.lines.push(`${label}: ${value}`);
    return this;
  }

  /** Adds a stat line with the raw CSV column value. */
  raw(label: string, column: string, suffix = ''): this {
    this.checkColumn('raw', label, column);
    const value = this.row?.[column] ?? '';
    this.lines.push(`${label}: ${value}${suffix}`);
    return this;
  }

  /** Adds a section header (preceded by a blank line in the INI output). */
  section(title: string): this {
    this.lines.push(`\n${title}`);
    return this;
  }

  /** Adds a stat line only if value is truthy. */
  lineIf(label: string, value: string | undefined): this {
    if (value) {
      this.lines.push(`${label}: ${value}`);
    }
    return this;
  }

  /** Adds a raw value line only if the column value exists and is not '0'. */
  rawIf(label: string, column: string, suffix = ''): this {
    this.checkColumn('rawIf', label, column);
    const value = this.row?.[column];
    if (value && value !== '0') {
      this.lines.push(`${label}: ${value}${suffix}`);
    }
    return this;
  }

  /** Finalizes the stat block, returning immutable ItemStats. */
  build(): ItemStats {
    return new ItemStats([...this.lines]);
  }

  /** For backward compatibility - returns string like original stat() function */
  buildLegacy(flavorText: string = ''): string {
    let val = this.lines.join('\n');
    if (flavorText) val += `\n\n${flavorText}`;
    return val;
  }
}