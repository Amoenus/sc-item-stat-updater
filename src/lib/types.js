/**
 * Shared properties for all item configs.
 * @typedef {object} BaseItemConfig
 * @property {string} [csvFile] - CSV filename relative to the CSV directory
 * @property {string} [jsonFile] - JSON filename relative to the CSV directory
 * @property {(json: unknown) => Array<Record<string, string>>} [parseJson] - Parses JSON content into rows
 * @property {string} label - Display label for logging
 * @property {string[]} requiredColumns - CSV/JSON columns required by buildValue (validated at parse time)
 * @property {(keyLower: string) => boolean} descKeyMatch - Identifies existing description keys in the INI file
 * @property {(row: Record<string, string>, flavorText: string, oldValue: string, targetKey: string) => string} buildValue - Transforms a row into an INI value
 * @property {(row: Record<string, string>, deriveDescKey: (nameKey: string) => string) => string[]} [getTargetKeys] - Returns the INI keys to update for a row, defaulting to the description key
 * @property {(nameKey: string) => string} [nameKeyToDescKey] - Override default name-to-desc key derivation
 * @property {(descKey: string) => string[]} [getAlternateDescKeys] - Extra keys to check for existing entries
 */

/**
 * Config for items whose CSV already contains a Localization Key column.
 * @typedef {BaseItemConfig & { nameColumn?: undefined, lookupCsvFile?: undefined }} DefaultItemConfig
 */

/**
 * Config for SPViewer items that require key resolution via reverse index lookup.
 * @typedef {BaseItemConfig & { nameColumn: string, lookupCsvFile?: string }} SPViewerItemConfig
 */

/**
 * Union of all item config types.
 * @typedef {DefaultItemConfig | SPViewerItemConfig} ItemConfig
 */

export {};
