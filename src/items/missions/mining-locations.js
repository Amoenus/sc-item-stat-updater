// @ts-check
// @ts-check
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);
const locationKeyMap = _require('./locationKeyMap.json');

// Roman numeral -> digit substitution (longest match first to avoid partial replacements)
/** @type {Record<string, string>} */
const ROMAN_MAP = { VIII: '8', VII: '7', VI: '6', IV: '4', V: '5', III: '3', II: '2', I: '1' };
const ROMAN_RE = /\b(VIII|VII|VI|IV|V|III|II|I)\b/g;

/**
 * Normalises a Location Name to a lowercase slug for INI key matching.
 * e.g. "Pyro I" -> "pyro1", "Aaron Halo" -> "aaronhalo"
 *
 * @param {string} name
 * @returns {string}
 */
function toLocationSlug(name) {
  return name
    .replace(ROMAN_RE, /** @param {string} m */ (m) => ROMAN_MAP[m])
    .replace(/[\s\-_]+/g, '')
    .toLowerCase();
}

export default {
  csvFile: 'mining-locations.csv',
  label: 'Mining locations',
  requiredColumns: ['Location Name', 'Ship Mineables', 'Hand Mineables'],
  // Only update keys that already exist in the INI (planet/moon descs don't get new entries)
  noInsert: true,
  descKeyMatch: (/** @type {string} */ kl) => /_desc$/i.test(kl) && !kl.startsWith('items_') && !kl.startsWith('journal_'),

  /**
   * Derives the target INI key(s) for a location row.
   * Priority: explicit entry in locationKeyMap.json, then slug-based derivation.
   *
   * @param {{'Location Name': string}} row
   * @returns {string[]}
   */
  getTargetKeys(row) {
    const name = row['Location Name'];
    if (!name) return [];

    /** @param {string[]} keys */
    const withPVariants = (keys) => {
      const out = [];
      const seen = new Set();
      for (const key of keys) {
        if (!key) continue;
        if (!seen.has(key)) {
          out.push(key);
          seen.add(key);
        }
        const pVariant = key.endsWith(',P') ? key : `${key},P`;
        if (!seen.has(pVariant)) {
          out.push(pVariant);
          seen.add(pVariant);
        }
      }
      return out;
    };

    // 1. Static map override (handles irregular names / multiple keys per location)
    const mapped = locationKeyMap[name];
    if (mapped) return withPVariants(Array.isArray(mapped) ? mapped : [mapped]);

    // 2. Slug fallback: "Aaron Halo" -> "aaronhalo_desc", "Pyro I" -> "pyro1_desc"
    const slug = toLocationSlug(name);
    return withPVariants([`${slug}_desc`]);
  },

  /**
   * Builds the new INI value for a location description.
   *
   * @param {{'Location Name': string, 'Ship Mineables': string, 'Hand Mineables': string}} row
   * @param {string} flavorText - existing flavor text from INI (everything before first "Potential " section)
   * @param {string} oldValue - current INI value
   * @param {string} targetKey - the INI key being updated
   * @returns {string} new INI value with updated mineable sections
   */
  buildValue(row, flavorText, oldValue, targetKey) {
    // If we don't have a target key (not in our map), skip the update
    if (!targetKey) {
      return oldValue;
    }

    // Extract flavor text: everything before the first "Potential " section heading
    const potentialIndex = oldValue.indexOf('\\n\\nPotential ');
    let cleanFlavorText = oldValue;
    if (potentialIndex !== -1) {
      cleanFlavorText = oldValue.substring(0, potentialIndex);
    }

    // Parse existing "Potential X:" sections into a dict
    /** @type {Record<string, string>} */
    const sections = {};
    const potentialRegex = /\\n\\nPotential ([^:]+):\\n([\s\S]*?)(?=\\n\\nPotential |$)/g;
    let match;
    while ((match = potentialRegex.exec(oldValue)) !== null) {
      const sectionName = match[1]; // e.g., "Ship Mineables"
      const sectionContent = match[2].trim();
      sections[sectionName] = sectionContent;
    }

    // Get CSV values
    const shipMineables = row['Ship Mineables'] || '';
    const handMineables = row['Hand Mineables'] || '';

    // Update sections
    if (shipMineables.trim() !== '') {
      // Split on actual newlines from CSV, join with literal \n for INI
      const shipList = shipMineables
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .join('\\n');
      sections['Ship Mineables'] = shipList;
    } else {
      // Remove section if empty in CSV
      delete sections['Ship Mineables'];
    }

    if (handMineables.trim() !== '') {
      const handList = handMineables
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .join('\\n');
      sections['Hand Mineables'] = handList;
    } else {
      delete sections['Hand Mineables'];
    }

    // Note: We do not modify Ground Vehicle Mineables, Harvestables, Creatures

    // Define canonical section order
    const sectionOrder = [
      'Ship Mineables',
      'Ground Vehicle Mineables',
      'Hand Mineables',
      'Harvestables',
      'Creatures'
    ];

    // Re-assemble
    let result = cleanFlavorText;

    for (const sectionName of sectionOrder) {
      if (sections[sectionName] !== undefined) {
        const content = sections[sectionName];
        if (content.trim() !== '') {
          result += `\\n\\nPotential ${sectionName}:\\n${content}`;
        }
      }
    }

    return result;
  },
};
