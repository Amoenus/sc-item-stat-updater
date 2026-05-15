export function nameKeyToDescKey(nameKey) {
  return nameKey.replace(/(item_)(Name|name|NAME)/i, (_m, prefix, word) => {
    if (word === 'name') return `${prefix}desc`;
    if (word === 'NAME') return `${prefix}DESC`;
    return `${prefix}Desc`;
  });
}

export function extractFlavorText(value) {
  const parts = value.split('\\n\\n');
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].trim();
    if (!lastPart.startsWith('--')) return lastPart;
  }
  return '';
}

/**
 * Extracts all localization placeholders (e.g. %name, ~name(param)) from a string.
 * Uses patterns compatible with @dymerz/starcitizen-ini-utils.
 * @param {string} value
 * @returns {string[]} Array of matched placeholders
 */
export function extractPlaceholders(value) {
  if (!value) return [];
  const placeholders = [];

  const tildeRegex = /(~\w+\(.*?\))/g;
  let match;
  while ((match = tildeRegex.exec(value)) !== null) {
    placeholders.push(match[1]);
  }

  const percentRegex = /(%\w+)/g;
  while ((match = percentRegex.exec(value)) !== null) {
    placeholders.push(match[1]);
  }

  return placeholders;
}

/**
 * Identifies placeholders in oldValue that are missing from newValue and appends them.
 * This prevents validation errors where placeholders in stat blocks are lost.
 * @param {string} oldValue
 * @param {string} newValue
 * @returns {string} The newValue with any missing placeholders appended
 */
export function appendMissingPlaceholders(oldValue, newValue) {
  const oldPlaceholders = extractPlaceholders(oldValue);
  const newPlaceholders = extractPlaceholders(newValue);

  const missingPlaceholders = oldPlaceholders.filter((p) => !newPlaceholders.includes(p));

  if (missingPlaceholders.length > 0) {
    return `${newValue} ${missingPlaceholders.join(' ')}`;
  }

  return newValue;
}
