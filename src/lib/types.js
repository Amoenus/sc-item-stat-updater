/**
 * Shared properties for all item configs.
 * @typedef {object} BaseItemConfig
 * @property {string} csvFile - CSV filename relative to the CSV directory
 * @property {string} label - Display label for logging
 * @property {string[]} requiredColumns - CSV columns required by buildValue (validated at parse time)
 * @property {(keyLower: string) => boolean} descKeyMatch - Identifies existing description keys in the INI file
 * @property {(row: Record<string, string>, flavorText: string) => string} buildValue - Transforms a CSV row into an INI description value
 * @property {(row: Record<string, string>, lookupRows?: Record<string, string>[]) => string} [buildName] - Optional function to transform a CSV row into a localization name value
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
