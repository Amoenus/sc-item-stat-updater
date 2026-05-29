import { getLogger } from './logger';

const logger = getLogger('key-resolver');

const NAME_KEY_RE = /^item_Name/i;
const SKIP_SUFFIX_RE = /_(short|mag|barrel|ammo)$/i;

/**
 * Builds a reverse index from INI lines: display-name value → item_Name key.
 * Skips auxiliary entries (_short, _mag, etc.) to prefer canonical keys.
 */
export function buildReverseNameIndex(lines: string[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const line of lines) {
    const eqIdx = line.indexOf('=');
    if (eqIdx < 0) continue;
    const iniKey = line.substring(0, eqIdx);
    if (!NAME_KEY_RE.test(iniKey)) continue;
    if (SKIP_SUFFIX_RE.test(iniKey)) continue;
    const displayName = line.substring(eqIdx + 1).trim();
    if (!displayName) continue;
    if (!index.has(displayName)) {
      index.set(displayName, iniKey);
    }
  }
  return index;
}

export type ResolvedRow = Record<string, string> & { 'Localization Key': string };

function findBySuffix(
  suffix: string,
  lookupMap: Map<string, string> | undefined,
  reverseIndex: Map<string, string>,
): string | undefined {
  if (lookupMap) {
    for (const [mapName, key] of lookupMap) {
      if (mapName.endsWith(suffix)) return key;
    }
  }
  for (const [value, key] of reverseIndex) {
    if (value.endsWith(suffix)) return key;
  }
  return undefined;
}

function resolveName(
  name: string,
  lookupMap: Map<string, string> | undefined,
  reverseIndex: Map<string, string>,
): string | undefined {
  const exact = lookupMap?.get(name) ?? reverseIndex.get(name);
  if (exact) return exact;

  const bySuffix = findBySuffix(` ${name}`, lookupMap, reverseIndex);
  if (bySuffix) return bySuffix;

  const stripped = name.replace(/\s+\([^)]+\)$/, '');
  if (stripped !== name) {
    const strippedExact = lookupMap?.get(stripped) ?? reverseIndex.get(stripped);
    if (strippedExact) return strippedExact;
    return findBySuffix(` ${stripped}`, lookupMap, reverseIndex);
  }

  return undefined;
}

/**
 * Resolves Localization Key for spviewer CSV rows that only have display names.
 * Does NOT mutate the input array. Returns a new array of resolved rows (with
 * 'Localization Key' added as a new property on a shallow copy of each row),
 * the list of unresolved names, and the full resolved mapping.
 */
export function resolveLocalizationKeys(
  rows: Record<string, string>[],
  nameColumn: string,
  reverseIndex: Map<string, string>,
  lookupMap?: Map<string, string>,
  savedMapping?: Map<string, string>,
): { resolved: ResolvedRow[]; unresolved: string[]; mapping: Map<string, string> } {
  const resolved: ResolvedRow[] = [];
  const unresolved: string[] = [];
  const mapping = new Map<string, string>(savedMapping);
  for (const row of rows) {
    const name = row[nameColumn];
    if (!name) {
      unresolved.push('(empty)');
      continue;
    }
    const locKey = savedMapping?.get(name) ?? resolveName(name, lookupMap, reverseIndex);
    if (locKey) {
      resolved.push({ ...row, 'Localization Key': locKey });
      mapping.set(name, locKey);
    } else {
      unresolved.push(name);
    }
  }
  if (unresolved.length > 0) {
    logger.debug('Unresolved items (no localization key found)', {
      count: unresolved.length,
      sample: unresolved.slice(0, 5).join(', '),
    });
  }
  return { resolved, unresolved, mapping };
}
