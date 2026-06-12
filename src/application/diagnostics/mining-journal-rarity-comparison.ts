import { readCsvFile } from '../../io/local/csv-parser';
import { resolveChildPath } from '../../io/local/path-conventions';
import { hasRenderableRarityRows, loadDataCoreMiningJournalRows } from '../../items/missions/mining-journal';

const RARITY_ORDER = ['Legendary', 'Epic', 'Rare', 'Uncommon', 'Common'];

export interface MiningJournalRarityMismatch {
  element: string;
  scmdbRarity?: string;
  datacoreRarity?: string;
}

export interface MiningJournalRarityComparison {
  scmdbRows: number;
  datacoreRows: number;
  scmdbElements: number;
  datacoreElements: number;
  matchedElements: number;
  mismatches: MiningJournalRarityMismatch[];
  missingFromDataCore: MiningJournalRarityMismatch[];
  missingFromScmdb: MiningJournalRarityMismatch[];
  scmdbGroupCounts: Record<string, number>;
  datacoreGroupCounts: Record<string, number>;
  usableDataCore: boolean;
}

export async function buildMiningJournalRarityComparison(options: {
  scmdbDir: string;
  datacoreDir?: string;
}): Promise<MiningJournalRarityComparison> {
  const [scmdbRows, datacoreRows] = await Promise.all([
    readCsvFile(resolveChildPath(options.scmdbDir, 'mining-journal.csv', 'SCMDB mining journal CSV filename')),
    loadDataCoreMiningJournalRows(options.datacoreDir),
  ]);

  return compareMiningJournalRarityRows({ scmdbRows, datacoreRows });
}

export function compareMiningJournalRarityRows({
  scmdbRows,
  datacoreRows,
}: {
  scmdbRows: Record<string, string>[];
  datacoreRows: Record<string, string>[];
}): MiningJournalRarityComparison {
  const scmdbGroups = extractElementRarityMap(scmdbRows);
  const datacoreGroups = extractElementRarityMap(datacoreRows);
  const mismatches: MiningJournalRarityMismatch[] = [];
  const missingFromDataCore: MiningJournalRarityMismatch[] = [];
  const missingFromScmdb: MiningJournalRarityMismatch[] = [];
  let matchedElements = 0;

  for (const [elementKey, scmdb] of [...scmdbGroups.entries()].sort((a, b) =>
    a[1].element.localeCompare(b[1].element),
  )) {
    const datacore = datacoreGroups.get(elementKey);
    if (!datacore) {
      missingFromDataCore.push({ element: scmdb.element, scmdbRarity: scmdb.rarity });
      continue;
    }
    if (scmdb.rarity !== datacore.rarity) {
      mismatches.push({
        element: scmdb.element,
        scmdbRarity: scmdb.rarity,
        datacoreRarity: datacore.rarity,
      });
      continue;
    }
    matchedElements++;
  }

  for (const [elementKey, datacore] of [...datacoreGroups.entries()].sort((a, b) =>
    a[1].element.localeCompare(b[1].element),
  )) {
    if (!scmdbGroups.has(elementKey)) {
      missingFromScmdb.push({ element: datacore.element, datacoreRarity: datacore.rarity });
    }
  }

  return {
    scmdbRows: scmdbRows.length,
    datacoreRows: datacoreRows.length,
    scmdbElements: scmdbGroups.size,
    datacoreElements: datacoreGroups.size,
    matchedElements,
    mismatches,
    missingFromDataCore,
    missingFromScmdb,
    scmdbGroupCounts: countRarityGroups(scmdbGroups),
    datacoreGroupCounts: countRarityGroups(datacoreGroups),
    usableDataCore: hasRenderableRarityRows(datacoreRows),
  };
}

export function formatMiningJournalRarityComparison(comparison: MiningJournalRarityComparison): string {
  const lines = [
    'Mining journal rarity comparison',
    `  SCMDB rows/elements: ${comparison.scmdbRows}/${comparison.scmdbElements}`,
    `  DataCore-inferred rows/elements: ${comparison.datacoreRows}/${comparison.datacoreElements}`,
    `  Matching rarity labels: ${comparison.matchedElements}/${comparison.scmdbElements}`,
    `  DataCore inference usable: ${comparison.usableDataCore ? 'yes' : 'no'}`,
    `  SCMDB group counts: ${formatGroupCounts(comparison.scmdbGroupCounts)}`,
    `  DataCore group counts: ${formatGroupCounts(comparison.datacoreGroupCounts)}`,
    `  Mismatched rarity labels: ${comparison.mismatches.length}`,
    ...formatMismatchLines(comparison.mismatches),
    `  Missing from DataCore inference: ${comparison.missingFromDataCore.length}`,
    ...formatMismatchLines(comparison.missingFromDataCore),
    `  Missing from SCMDB journal: ${comparison.missingFromScmdb.length}`,
    ...formatMismatchLines(comparison.missingFromScmdb),
  ];

  return lines.join('\n');
}

function extractElementRarityMap(rows: Record<string, string>[]): Map<string, { element: string; rarity: string }> {
  const groups = new Map<string, { element: string; rarity: string }>();
  for (const row of rows) {
    const rarity = row['Rarity Category']?.trim();
    const elementList = row['Element List'] ?? '';
    if (!rarity || !RARITY_ORDER.includes(rarity)) continue;

    for (const element of elementList.split(/\r?\n/).map((entry) => entry.trim())) {
      if (!element) continue;
      groups.set(normalizeElementName(element), { element, rarity });
    }
  }
  return groups;
}

function normalizeElementName(element: string): string {
  return element.toLowerCase().replace(/\s+/g, ' ').trim();
}

function countRarityGroups(groups: Map<string, { element: string; rarity: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const rarity of RARITY_ORDER) counts[rarity] = 0;
  for (const { rarity } of groups.values()) {
    counts[rarity] = (counts[rarity] ?? 0) + 1;
  }
  return counts;
}

function formatGroupCounts(counts: Record<string, number>): string {
  return RARITY_ORDER.map((rarity) => `${rarity} ${counts[rarity] ?? 0}`).join(', ');
}

function formatMismatchLines(mismatches: MiningJournalRarityMismatch[]): string[] {
  const visible = mismatches.slice(0, 10).map((mismatch) => {
    const scmdb = mismatch.scmdbRarity ?? '-';
    const datacore = mismatch.datacoreRarity ?? '-';
    return `    ${mismatch.element}: SCMDB=${scmdb}, DataCore=${datacore}`;
  });
  if (mismatches.length > visible.length) {
    visible.push(`    ... ${mismatches.length - visible.length} more`);
  }
  return visible;
}
