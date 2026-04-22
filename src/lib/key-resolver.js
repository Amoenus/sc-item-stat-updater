import { getLogger } from './logger.js';

const logger = getLogger('key-resolver');

const NAME_KEY_RE = /^item_Name/i;
const SKIP_SUFFIX_RE = /_(short|mag|barrel|ammo)$/i;

/**
 * Builds a reverse index from INI lines: display-name value → item_Name key.
 * Skips auxiliary entries (_short, _mag, etc.) to prefer canonical keys.
 *
 * @param {string[]} lines - INI file lines
 * @returns {Map<string, string>} displayName → localizationKey
 */
function keyPreferenceScore(key) {
  const normalized = String(key ?? '').toLowerCase();
  let score = 0;
  if (/_scitem$/.test(normalized)) score += 10;
  if (normalized.startsWith('item_name')) score += 1;
  return score;
}

export function buildReverseNameIndex(lines) {
  const index = new Map();
  for (const line of lines) {
    const eqIdx = line.indexOf('=');
    if (eqIdx < 0) continue;
    const key = line.substring(0, eqIdx);
    if (!NAME_KEY_RE.test(key)) continue;
    if (SKIP_SUFFIX_RE.test(key)) continue;
    const value = line.substring(eqIdx + 1).trim();
    if (!value) continue;
    const existing = index.get(value);
    if (!existing) {
      index.set(value, key);
      continue;
    }
    const currentScore = keyPreferenceScore(existing);
    const candidateScore = keyPreferenceScore(key);
    if (candidateScore > currentScore) {
      index.set(value, key);
    }
  }
  return index;
}

/**
 * Resolves Localization Key for spviewer CSV rows that only have display names.
 * Mutates rows in-place, adding a 'Localization Key' property.
 * Returns an object with unresolved names and the full resolved mapping.
 *
 * @param {Record<string,string>[]} rows - Parsed spviewer CSV rows
 * @param {string} nameColumn - CSV column containing the display name
 * @param {Map<string,string>} reverseIndex - INI value → key index
 * @param {Map<string,string>} [lookupMap] - Optional lookup CSV name → key map
 * @param {Map<string,string>} [savedMapping] - Previously saved name → key mapping
 * @returns {{ unresolved: string[], mapping: Map<string, string> }}
 */
export function resolveLocalizationKeys(rows, nameColumn, reverseIndex, lookupMap, savedMapping) {
  const unresolved = [];
  const mapping = new Map(savedMapping);
  for (let i = rows.length - 1; i >= 0; i--) {
    const name = rows[i][nameColumn];
    if (!name) {
      rows.splice(i, 1);
      unresolved.push('(empty)');
      continue;
    }
    // 0. Saved mapping takes first priority
    let locKey = savedMapping?.get(name);
    // 1. Exact match from lookup CSV or INI reverse index
    if (!locKey) locKey = lookupMap?.get(name) ?? reverseIndex.get(name);
    // 2. Suffix match: find INI values that end with " <name>"
    if (!locKey) {
      const suffix = ` ${name}`;
      if (lookupMap) {
        for (const [mapName, key] of lookupMap) {
          if (mapName.endsWith(suffix)) {
            locKey = key;
            break;
          }
        }
      }
      if (!locKey) {
        for (const [value, key] of reverseIndex) {
          if (value.endsWith(suffix)) {
            locKey = key;
            break;
          }
        }
      }
    }
    if (locKey) {
      rows[i]['Localization Key'] = locKey;
      mapping.set(name, locKey);
    } else {
      rows.splice(i, 1);
      unresolved.push(name);
    }
  }
  if (unresolved.length > 0) {
    logger.debug('Unresolved items (no localization key found)', {
      count: unresolved.length,
      sample: unresolved.slice(0, 5),
    });
  }
  return { unresolved, mapping };
}
