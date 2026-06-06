import type { ItemConfig } from '../../enrichment/item-config';
import { deriveMiningDifficulty, deriveVolatilityNote } from '../../extractor/mining-parser';
import { getLogger } from '../../infrastructure/logger';
import { readCsvFile } from '../../io/local/csv-parser';
import { resolveChildPath } from '../../io/local/path-conventions';

const DATACORE_MINING_ELEMENTS_CSV = 'mining-elements.datacore.csv';
const DATACORE_MINING_COMPOSITIONS_CSV = 'mining-compositions.datacore.csv';
const DATACORE_MINING_QUALITY_DISTRIBUTIONS_CSV = 'mining-quality-distributions.datacore.csv';
const logger = getLogger('mining-journal-config');

const RARITY_ORDER = ['Legendary', 'Epic', 'Rare', 'Uncommon', 'Common'];
const ORE_OR_RAW_SUFFIX = /\((Ore|Raw)\)\s*$/;

interface DataCoreMiningJournalSourceRows {
  elements: Record<string, string>[];
  compositions: Record<string, string>[];
  qualityDistributions?: Record<string, string>[];
}

interface ElementFacts {
  name: string;
  guid: string;
  elementClass: string;
  resistance?: number;
  instability?: number;
  optimalWindowThinness?: number;
  optimalWindowRandomness?: number;
  explosionMultiplier?: number;
}

interface CompositionStats {
  probabilitySum: number;
  probabilityCount: number;
}

/** Builds the journal value from CSV rows. Returns new INI value with rarity-grouped format. */
export function buildJournalValue(rows: Array<Record<string, string>>, oldValue: string): string {
  // Extract intro block - everything before first "\\n\\n**" (start of first rarity section)
  const introEndIndex = oldValue.indexOf(String.raw`\n\n**`);
  const introBlock = introEndIndex === -1 ? oldValue : oldValue.substring(0, introEndIndex);
  const insights = rows.map((row) => row['Insight Summary'] ?? '').find((value) => value.trim().length > 0);

  // Group elements by rarity category
  const rarityGroups: Record<string, string[]> = {};
  for (const row of rows) {
    const rarityCategory = row['Rarity Category'];
    const elementList = row['Element List'];

    if (rarityCategory && elementList && rarityCategory !== 'Unknown') {
      // Split element list by actual newlines from CSV, then trim
      const elements = elementList
        .split(/\r?\n/)
        .map((elem) => elem.trim())
        .filter((elem) => elem.length > 0);

      if (elements.length > 0) {
        rarityGroups[rarityCategory] = elements;
      }
    }
  }

  // Build sections in correct order
  let result = introBlock;
  const nlSep = String.raw`\n`;

  if (insights) {
    result += String.raw`\n\n** Mining Insights **\n${insights}`;
  }

  // Add each rarity section if it has elements
  for (const rarity of RARITY_ORDER) {
    const elements = rarityGroups[rarity];
    if (elements && elements.length > 0) {
      result += String.raw`\n\n** ${rarity} **\n${elements.join(nlSep)}`;
    }
  }

  return result;
}

export function buildDataCoreMiningJournalRows({
  elements,
  compositions,
  qualityDistributions = [],
}: DataCoreMiningJournalSourceRows): Record<string, string>[] {
  const elementFacts = buildElementFacts(elements);
  const compositionStats = buildCompositionStats(compositions);
  const rarityGroups = new Map<string, string[]>();

  for (const element of uniqueElements([...elementFacts.values()])) {
    if (!ORE_OR_RAW_SUFFIX.test(element.name)) continue;

    const stats =
      compositionStats.get(element.guid.toLowerCase()) ?? compositionStats.get(element.elementClass.toLowerCase());
    if (!stats || stats.probabilityCount === 0) continue;

    const rarity = inferRarityCategory(stats.probabilitySum / stats.probabilityCount);
    const group = rarityGroups.get(rarity) ?? [];
    group.push(element.name);
    rarityGroups.set(rarity, group);
  }

  const rows = RARITY_ORDER.toReversed()
    .filter((rarity) => rarityGroups.has(rarity))
    .map((rarity) => ({
      'Rarity Category': rarity,
      'Element List': (rarityGroups.get(rarity) ?? []).sort((a, b) => a.localeCompare(b)).join('\n'),
      'Insight Summary': '',
      Source: 'DataCore-inferred',
    }));

  const insightSummary = buildDataCoreInsightSummary([...elementFacts.values()], qualityDistributions);
  if (insightSummary) {
    rows.unshift({
      'Rarity Category': 'Insights',
      'Element List': '',
      'Insight Summary': insightSummary,
      Source: 'DataCore-inferred',
    });
  }

  return rows;
}

export async function loadDataCoreMiningJournalRows(
  datacoreDir: string | undefined,
): Promise<Record<string, string>[]> {
  if (!datacoreDir) return [];

  try {
    const [elements, compositions, qualityDistributions] = await Promise.all([
      readCsvFile(resolveChildPath(datacoreDir, DATACORE_MINING_ELEMENTS_CSV, 'DataCore mining elements CSV filename')),
      readCsvFile(
        resolveChildPath(datacoreDir, DATACORE_MINING_COMPOSITIONS_CSV, 'DataCore mining compositions CSV filename'),
      ),
      readCsvFile(
        resolveChildPath(
          datacoreDir,
          DATACORE_MINING_QUALITY_DISTRIBUTIONS_CSV,
          'DataCore mining quality distributions CSV filename',
        ),
      ),
    ]);
    const rows = buildDataCoreMiningJournalRows({ elements, compositions, qualityDistributions });
    return hasRenderableRarityRows(rows) ? rows : [];
  } catch (err) {
    if (isFileNotFound(err)) {
      logger.warn('DataCore mining journal inputs missing; using SCMDB mining journal fallback', {
        datacoreDir,
        csvFiles: [
          DATACORE_MINING_ELEMENTS_CSV,
          DATACORE_MINING_COMPOSITIONS_CSV,
          DATACORE_MINING_QUALITY_DISTRIBUTIONS_CSV,
        ].join(', '),
      });
      return [];
    }
    throw err;
  }
}

export function hasRenderableRarityRows(rows: Record<string, string>[]): boolean {
  return rows.some(
    (row) => row['Rarity Category'] && row['Rarity Category'] !== 'Unknown' && row['Element List']?.trim(),
  );
}

function buildElementFacts(rows: Record<string, string>[]): Map<string, ElementFacts> {
  const facts = new Map<string, ElementFacts>();
  for (const row of rows) {
    const name = row['Element Name']?.trim();
    const guid = row['Record GUID']?.trim();
    const elementClass = row['Element Class']?.trim();
    if (!name || (!guid && !elementClass)) continue;

    const element: ElementFacts = {
      name,
      guid,
      elementClass,
      resistance: parseOptionalNumber(row.Resistance),
      instability: parseOptionalNumber(row.Instability),
      optimalWindowThinness: parseOptionalNumber(row['Optimal Window Thinness']),
      optimalWindowRandomness: parseOptionalNumber(row['Optimal Window Randomness']),
      explosionMultiplier: parseOptionalNumber(row['Explosion Multiplier']),
    };
    if (guid) facts.set(guid.toLowerCase(), element);
    if (elementClass) facts.set(elementClass.toLowerCase(), element);
  }
  return facts;
}

function buildCompositionStats(rows: Record<string, string>[]): Map<string, CompositionStats> {
  const stats = new Map<string, CompositionStats>();
  for (const row of rows) {
    const keys = [row['Mineable Element GUID'], row['Mineable Element Class']]
      .map((value) => value?.trim())
      .filter(Boolean);
    const probability = parseOptionalNumber(row.Probability);
    if (keys.length === 0 || probability === undefined) continue;

    for (const key of keys) {
      const normalizedKey = key.toLowerCase();
      const current = stats.get(normalizedKey) ?? { probabilitySum: 0, probabilityCount: 0 };
      current.probabilitySum += probability;
      current.probabilityCount++;
      stats.set(normalizedKey, current);
    }
  }
  return stats;
}

function inferRarityCategory(averageProbability: number): string {
  if (averageProbability >= 0.95) return 'Common';
  if (averageProbability >= 0.55) return 'Uncommon';
  if (averageProbability >= 0.25) return 'Rare';
  if (averageProbability >= 0.18) return 'Epic';
  return 'Legendary';
}

function buildDataCoreInsightSummary(elements: ElementFacts[], qualityDistributions: Record<string, string>[]): string {
  const mineableElements = uniqueElements(elements).filter((element) => ORE_OR_RAW_SUFFIX.test(element.name));
  const hardest = mineableElements
    .toSorted((a, b) => difficultyScore(b) - difficultyScore(a))
    .slice(0, 5)
    .map((element) => `${element.name} (${deriveMiningDifficulty(element)})`);
  const volatile = mineableElements
    .toSorted((a, b) => volatilityScore(b) - volatilityScore(a))
    .slice(0, 5)
    .map((element) => `${element.name} (${deriveVolatilityNote(element)})`);
  const qualityFloor = buildQualityFloorInsight(qualityDistributions);

  return [
    hardest.length ? `Hardest: ${hardest.join(', ')}` : '',
    volatile.length ? `Most Volatile: ${volatile.join(', ')}` : '',
    qualityFloor,
  ]
    .filter(Boolean)
    .join('\n');
}

function uniqueElements(elements: ElementFacts[]): ElementFacts[] {
  const seen = new Set<string>();
  const unique: ElementFacts[] = [];
  for (const element of elements) {
    const key = element.guid || element.elementClass || element.name;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(element);
  }
  return unique;
}

function difficultyScore(element: ElementFacts): number {
  const difficulty = deriveMiningDifficulty(element);
  return { Easy: 1, Moderate: 2, Difficult: 3, Volatile: 4, Extreme: 5 }[difficulty] ?? 0;
}

function volatilityScore(element: ElementFacts): number {
  return (element.explosionMultiplier ?? 0) + (element.instability ?? 0) / 100;
}

function buildQualityFloorInsight(rows: Record<string, string>[]): string {
  const defaultRows = rows.filter((row) => row['Distribution Type'] === 'default' && row['Min Quality']);
  if (defaultRows.length === 0) return '';

  const summaries = defaultRows
    .map((row) => {
      const family = row['Mineable Family'];
      const min = parseOptionalNumber(row['Min Quality']);
      const max = parseOptionalNumber(row['Max Quality']);
      if (!family || min === undefined || max === undefined) return '';
      return `${family}: ${(min / 10).toFixed(1)}-${(max / 10).toFixed(1)}%`;
    })
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return summaries.length ? `Quality Floors: ${summaries.join('; ')}` : '';
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isFileNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'ENOENT';
}

export default {
  csvFile: 'mining-journal.csv',
  sourceFiles: [
    { file: DATACORE_MINING_ELEMENTS_CSV, sourceDir: 'datacore' },
    { file: DATACORE_MINING_COMPOSITIONS_CSV, sourceDir: 'datacore' },
    { file: DATACORE_MINING_QUALITY_DISTRIBUTIONS_CSV, sourceDir: 'datacore' },
  ],
  label: 'Mining journal',
  requiredColumns: ['Rarity Category', 'Element List'],
  // Handled explicitly in update-all.js via buildJournalValue; skip the standard runUpdate loop
  skip: true,
  descKeyMatch: (kl: string) => kl.startsWith('journal_general_mining'),
} satisfies ItemConfig;
