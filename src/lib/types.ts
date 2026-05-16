/**
 * Shared properties for all item configs.
 */
export interface BaseItemConfig {
  /** CSV filename relative to the CSV directory */
  csvFile?: string;
  /** JSON filename relative to the CSV directory */
  jsonFile?: string;
  /** Parses JSON content into rows */
  parseJson?: (json: unknown) => Array<Record<string, string>>;
  /** Resolves JSON source file path at runtime */
  resolveJsonFile?: (csvDir: string) => Promise<string>;
  /** Display label for logging */
  label: string;
  /** CSV/JSON columns required by buildValue (validated at parse time) */
  requiredColumns: string[];
  /** If true, config is skipped by the standard batch updater loop */
  skip?: boolean;
  /** If true, missing keys are skipped instead of inserted */
  noInsert?: boolean;
  /** Identifies existing description keys in the INI file */
  descKeyMatch: (keyLower: string) => boolean;
  /** Transforms a row into an INI value */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildValue?: (row: Record<string, string>, flavorText: string, oldValue: string, targetKey: string) => string;
  /** Returns the INI keys to update for a row, defaulting to the description key */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getTargetKeys?: (row: any, deriveDescKey: (nameKey: string) => string) => string[];
  /** Override default name-to-desc key derivation */
  nameKeyToDescKey?: (nameKey: string) => string;
  /** Extra keys to check for existing entries */
  getAlternateDescKeys?: (descKey: string) => string[];
}

export interface ItemConfig extends BaseItemConfig {
  nameColumn?: string;
  lookupCsvFile?: string;
}
