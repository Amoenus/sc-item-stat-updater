/**
 * @typedef {object} ItemConfig
 * @property {string} csvFile - CSV filename relative to the CSV directory
 * @property {string} label - Display label for logging
 * @property {string[]} requiredColumns - CSV columns required by buildValue (validated at parse time)
 * @property {(keyLower: string) => boolean} descKeyMatch - Identifies existing description keys in the INI file
 * @property {(row: Record<string, string>, flavorText: string) => string} buildValue - Transforms a CSV row into an INI description value
 * @property {(nameKey: string) => string} [nameKeyToDescKey] - Override default name-to-desc key derivation
 * @property {(descKey: string) => string[]} [getAlternateDescKeys] - Extra keys to check for existing entries
 */

export {};
