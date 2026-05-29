import { readJsonRelative } from '../../io/local/json-file';
import type { ItemConfig } from '../../lib/types';

const locationKeyMap = (await readJsonRelative(import.meta.url, './locationKeyMap.json', 'location key map')) as Record<
  string,
  unknown
>;
const POTENTIAL_SECTION_MARKER = String.raw`\n\nPotential `;
const QUALITY_NOTES_MARKER = String.raw`\n\nQuality Notes:`;
const INI_NEWLINE = String.raw`\n`;

// Roman numeral -> digit substitution (longest match first to avoid partial replacements)
const ROMAN_MAP: Record<string, string> = { VIII: '8', VII: '7', VI: '6', IV: '4', V: '5', III: '3', II: '2', I: '1' };
const ROMAN_RE = /\b(VIII|VII|VI|IV|V|III|II|I)\b/g;

/**
 * Normalises a Location Name to a lowercase slug for INI key matching.
 * e.g. "Pyro I" -> "pyro1", "Aaron Halo" -> "aaronhalo"
 */
function toLocationSlug(name: string): string {
  return name
    .replaceAll(ROMAN_RE, (m: string) => ROMAN_MAP[m])
    .replaceAll(/[\s\-_]+/g, '')
    .toLowerCase();
}

export default {
  csvFile: 'mining-locations.csv',
  label: 'Mining locations',
  requiredColumns: ['Location Name', 'Ship Mineables', 'Hand Mineables'],
  // Optional columns (added by enriched scraper): 'Ground Vehicle Mineables', 'Quality Note'
  // Only update keys that already exist in the INI (planet/moon descs don't get new entries)
  noInsert: true,
  descKeyMatch: (kl: string) => /_desc$/i.test(kl) && !kl.startsWith('items_') && !kl.startsWith('journal_'),

  /**
   * Derives the target INI key(s) for a location row.
   * Priority: explicit entry in locationKeyMap.json, then slug-based derivation.
   */
  getTargetKeys(row) {
    const name = row['Location Name'];
    if (!name) return [];

    const withPVariants = (keys: string[]): string[] => {
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

  /** Builds the new INI value for a location description. */
  buildValue(row, _flavorText, oldValue, targetKey) {
    // If we don't have a target key (not in our map), skip the update
    if (!targetKey) {
      return oldValue;
    }

    // Extract flavor text: everything before the first "Potential " or "Quality Notes:" section
    const firstSectionIdx = Math.min(
      ...[oldValue.indexOf(POTENTIAL_SECTION_MARKER), oldValue.indexOf(QUALITY_NOTES_MARKER)]
        .filter((i) => i !== -1)
        .concat([Infinity]),
    );
    const cleanFlavorText = firstSectionIdx === Infinity ? oldValue : oldValue.substring(0, firstSectionIdx);

    // Parse existing "Potential X:" sections into a dict
    const sections: Record<string, string> = {};
    const potentialRegex = /\\n\\nPotential ([^:]+):\\n([\s\S]*?)(?=\\n\\nPotential |\\n\\nQuality Notes:|$)/g;
    for (let match = potentialRegex.exec(oldValue); match !== null; match = potentialRegex.exec(oldValue)) {
      const sectionName = match[1]; // e.g., "Ship Mineables"
      const sectionContent = match[2].trim();
      sections[sectionName] = sectionContent;
    }

    // Helper: parse a CSV cell (real newlines) into an INI-escaped line string
    const toIniLines = (csvCell: string): string =>
      csvCell
        .split(/\r?\n/)
        .map((item: string) => item.trim())
        .filter((item: string) => item.length > 0)
        .join(INI_NEWLINE);

    // Update Ship Mineables from CSV (now weighted: "Mineral — XX.X%")
    const shipMineables = row['Ship Mineables'] || '';
    if (shipMineables.trim()) {
      sections['Ship Mineables'] = toIniLines(shipMineables);
    } else {
      delete sections['Ship Mineables'];
    }

    // Update Hand Mineables from CSV (now weighted: "Mineral — XX.X%")
    const handMineables = row['Hand Mineables'] || '';
    if (handMineables.trim()) {
      sections['Hand Mineables'] = toIniLines(handMineables);
    } else {
      delete sections['Hand Mineables'];
    }

    // Update Ground Vehicle Mineables from CSV if the column is present
    const groundMineables = row['Ground Vehicle Mineables'] || '';
    if (groundMineables.trim()) {
      sections['Ground Vehicle Mineables'] = toIniLines(groundMineables);
    }
    // If the CSV column is absent or empty, preserve whatever was already in the INI (do nothing)

    // Define canonical section order
    const sectionOrder = ['Ship Mineables', 'Ground Vehicle Mineables', 'Hand Mineables', 'Harvestables', 'Creatures'];

    // Re-assemble Potential sections
    let result = cleanFlavorText;
    for (const sectionName of sectionOrder) {
      if (sections[sectionName] !== undefined && sections[sectionName].trim() !== '') {
        result += String.raw`\n\nPotential ${sectionName}:\n${sections[sectionName]}`;
      }
    }

    // Append Quality Notes section if the CSV provides one (idempotent: old value already stripped above)
    const qualityNote = row['Quality Note'] || '';
    if (qualityNote.trim() !== '') {
      const noteLines = toIniLines(qualityNote);
      result += String.raw`\n\nQuality Notes:\n${noteLines}`;
    }

    return result;
  },
} satisfies ItemConfig;
