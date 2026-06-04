import type { ItemConfig } from '../../enrichment/item-config';

const SUFFIXLESS_TARGETS: Record<string, string> = {};
const COMMODITY_SLUG_ALIASES: Record<string, string> = {
  aluminium: 'aluminum',
};

function toCommoditySlug(name: string): string {
  const slug = name.toLowerCase().replace(/[\s-]/g, '');
  return COMMODITY_SLUG_ALIASES[slug] ?? slug;
}

function appendIfPresent(lines: string[], label: string, value: string | undefined): void {
  if (value && value.trim() !== '') lines.push(`${label}: ${value}`);
}

export default {
  csvFile: 'mining-elements.csv',
  label: 'Mining element stats',
  requiredColumns: ['Element Name', 'Rarity', 'Scan Signature', 'Resistance', 'Instability'],
  noInsert: true,
  descKeyMatch: (kl: string) =>
    kl.startsWith('items_commodities_') && (kl.endsWith('_ore_desc') || kl.endsWith('_raw_desc')),

  getTargetKeys(row, _deriveDescKey) {
    const elementName = row['Element Name'];
    if (!elementName) return [];

    const suffixMatch = /^(.+?)\s*\((\w+)\)\s*$/.exec(elementName);
    if (suffixMatch) {
      const baseName = suffixMatch[1];
      const suffix = suffixMatch[2].toLowerCase();
      if (suffix !== 'ore' && suffix !== 'raw') return [];
      return [`items_commodities_${toCommoditySlug(baseName)}_${suffix}_desc`];
    }

    const mappedTarget = SUFFIXLESS_TARGETS[elementName] ?? SUFFIXLESS_TARGETS[toCommoditySlug(elementName)];
    return mappedTarget ? [mappedTarget] : [];
  },

  buildValue(row, _flavorText, oldValue, _targetKey) {
    const statsBlockMarker = String.raw`\n\n** Scanner Data **`;
    const statsBlockIndex = oldValue.indexOf(statsBlockMarker);
    const cleanFlavorText = statsBlockIndex === -1 ? oldValue : oldValue.substring(0, statsBlockIndex);

    const rarity = row['Rarity'] || 'N/A';
    const formattedRarity = rarity === 'N/A' ? 'N/A' : rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase();
    const scannerLines = [`Rarity: ${formattedRarity}`, `Scan Signature: ${row['Scan Signature'] || 'N/A'}`];
    appendIfPresent(scannerLines, 'Ground Scan Signature', row['Ground Scan Signature']);
    appendIfPresent(scannerLines, 'FPS Scan Signature', row['FPS Scan Signature']);
    appendIfPresent(scannerLines, 'Density', row.Density);
    scannerLines.push(`Resistance: ${row.Resistance || 'N/A'}`, `Instability: ${row.Instability || 'N/A'}`);

    const behaviorLines: string[] = [];
    appendIfPresent(behaviorLines, 'Difficulty', row['Mining Difficulty']);
    appendIfPresent(behaviorLines, 'Optimal Charge', row['Optimal Window Midpoint']);
    appendIfPresent(behaviorLines, 'Window Variance', row['Optimal Window Randomness']);
    appendIfPresent(behaviorLines, 'Window Width', row['Optimal Window Thinness']);
    appendIfPresent(behaviorLines, 'Volatility', row['Volatility Note']);
    appendIfPresent(behaviorLines, 'Cluster Tendency', row['Cluster Note']);
    appendIfPresent(behaviorLines, 'Quality Bands', row['Quality Bands']);

    const behaviorBlock = behaviorLines.length
      ? String.raw`\n\n** Mining Behavior **\n${behaviorLines.join(String.raw`\n`)}`
      : '';
    const refineryLine = row['Best Refinery'] ? String.raw`\n\nBest Refinery: ${row['Best Refinery']}` : '';
    const statsBlock = String.raw`\n\n** Scanner Data **\n${scannerLines.join(String.raw`\n`)}${behaviorBlock}${refineryLine}`;

    return cleanFlavorText + statsBlock;
  },
} satisfies ItemConfig;
