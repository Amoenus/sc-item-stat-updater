/**
 * Shared properties for all item configs.
 * @typedef {object} BaseItemConfig
 * @property {string} [csvFile] - CSV filename relative to the CSV directory
 * @property {string} [jsonFile] - JSON filename relative to the CSV directory
 * @property {(json: unknown) => Array<Record<string, string>>} [parseJson] - Parses JSON content into rows
 * @property {(csvDir: string) => Promise<string>} [resolveJsonFile] - Resolves JSON source file path at runtime
 * @property {string} label - Display label for logging
 * @property {string[]} requiredColumns - CSV/JSON columns required by buildValue (validated at parse time)
 * @property {boolean} [skip] - If true, config is skipped by the standard batch updater loop
 * @property {boolean} [noInsert] - If true, missing keys are skipped instead of inserted
 * @property {(keyLower: string) => boolean} descKeyMatch - Identifies existing description keys in the INI file
 * @property {(row: Record<string, string>, flavorText: string, oldValue: string, targetKey: string) => string} [buildValue] - Transforms a row into an INI value
 * @property {(row: any, deriveDescKey: (nameKey: string) => string) => string[]} [getTargetKeys] - Returns the INI keys to update for a row, defaulting to the description key
 * @property {(nameKey: string) => string} [nameKeyToDescKey] - Override default name-to-desc key derivation
 * @property {(descKey: string) => string[]} [getAlternateDescKeys] - Extra keys to check for existing entries
 */

/** @typedef {BaseItemConfig & { nameColumn?: string, lookupCsvFile?: string }} ItemConfig */
