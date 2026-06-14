import type {
  ScmdbMiningDataDTO as MiningDataDTO,
  ScmdbMiningElementRowDTO as MiningElementRowDTO,
  ScmdbMiningJournalRowDTO as MiningJournalRowDTO,
  ScmdbMiningLocationRowDTO as MiningLocationRowDTO,
  ScmdbLocationOverrideEntryDTO,
} from '../schema/scmdb.schemas';
import {
  ScmdbMiningElementRowSchema,
  ScmdbMiningJournalRowSchema,
  ScmdbMiningLocationRowSchema,
} from '../schema/scmdb.schemas';

/**
 * Builds rows for the mining elements CSV.
 */
function formatQualityBands(bands: number[] | undefined): string {
  return bands?.length ? bands.map((band) => `${(band / 10).toFixed(1)}%`).join(' / ') : '';
}

export function deriveMiningDifficulty(el: {
  resistance?: number;
  instability?: number;
  optimalWindowThinness?: number;
  optimalWindowRandomness?: number;
  explosionMultiplier?: number;
}): string {
  const score =
    (el.resistance ?? 0) * 2 +
    (el.instability ?? 0) / 350 +
    (el.optimalWindowThinness ?? 0) / 2 +
    (el.optimalWindowRandomness ?? 0) * 2 +
    (el.explosionMultiplier ?? 0) / 5;
  if (score >= 6) return 'Extreme';
  if (score >= 4.8) return 'Volatile';
  if (score >= 3.6) return 'Difficult';
  if (score >= 2.2) return 'Moderate';
  return 'Easy';
}

const DIFFICULTY_SCORE: Record<string, number> = {
  Easy: 1,
  Moderate: 2,
  Difficult: 3,
  Volatile: 4,
  Extreme: 5,
};

export function deriveVolatilityNote(el: { instability?: number; explosionMultiplier?: number }): string {
  const instability = el.instability ?? 0;
  const explosion = el.explosionMultiplier ?? 0;
  if (explosion >= 8 || instability >= 650) return 'Extreme fracture risk';
  if (explosion >= 5 || instability >= 450) return 'High explosion risk';
  if (instability >= 250) return 'Unstable charge behavior';
  return 'Low volatility';
}

export function deriveClusterNote(clusterFactor: number | undefined): string {
  if (clusterFactor === undefined) return '';
  if (clusterFactor >= 0.65) return 'Cluster-prone';
  if (clusterFactor >= 0.3) return 'Occasional clusters';
  return 'Isolated';
}

function buildRefineryHint(elementName: string, miningData: MiningDataDTO): string {
  const profiles = miningData.refineryProfiles ?? {};
  const refineries = Object.values(miningData.refineries ?? {});
  let bestBonus: number | null = null;
  let bestProfileIds: string[] = [];
  for (const [profileId, bonuses] of Object.entries(profiles)) {
    const bonus = bonuses[elementName];
    if (bonus === undefined) continue;
    if (bestBonus === null || bonus > bestBonus) {
      bestBonus = bonus;
      bestProfileIds = [profileId];
    } else if (bonus === bestBonus) {
      bestProfileIds.push(profileId);
    }
  }
  if (bestBonus === null || bestBonus <= 0) return '';
  const refineryNames = refineries
    .filter((refinery) => refinery.profileId && bestProfileIds.includes(refinery.profileId))
    .map((refinery) => refinery.name);
  const where =
    refineryNames.length === 1
      ? refineryNames[0]
      : refineryNames.length > 1
        ? `${refineryNames.length} refineries`
        : bestProfileIds[0];
  return `${where} (+${bestBonus})`;
}

export function buildMiningElementRows(miningData: MiningDataDTO): MiningElementRowDTO[] {
  const elements: MiningElementRowDTO[] = [];
  for (const [_id, el] of Object.entries(miningData.mineableElements || {})) {
    elements.push(
      ScmdbMiningElementRowSchema.parse({
        'Element Name': el.name,
        Rarity: el.rarity,
        'Ground Scan Signature': el.groundScanSignature,
        'FPS Scan Signature': el.fpsScanSignature,
        'Scan Signature': el.scanSignature,
        Resistance: el.resistance,
        Instability: el.instability,
        Density: el.density,
        'Optimal Window Midpoint': el.optimalWindowMidpoint,
        'Optimal Window Randomness': el.optimalWindowRandomness,
        'Optimal Window Thinness': el.optimalWindowThinness,
        'Explosion Multiplier': el.explosionMultiplier,
        'Cluster Factor': el.clusterFactor,
        'Quality Bands': formatQualityBands(el.qualityBands),
        'Material Name': el.materialName,
        'Mining Difficulty': deriveMiningDifficulty(el),
        'Volatility Note': deriveVolatilityNote(el),
        'Cluster Note': deriveClusterNote(el.clusterFactor),
        'Best Refinery': buildRefineryHint(el.name, miningData),
      }),
    );
  }
  return elements;
}

/**
 * Builds rows for the mining journal CSV.
 */
export function buildMiningJournalRows(miningData: MiningDataDTO): MiningJournalRowDTO[] {
  const rarityMap: Record<string, string[]> = {};
  for (const el of Object.values(miningData.mineableElements || {})) {
    const rarity = (el.rarity || 'Unknown').toLowerCase();
    const cat = rarity.charAt(0).toUpperCase() + rarity.slice(1);
    if (!rarityMap[cat]) rarityMap[cat] = [];
    rarityMap[cat].push(el.name);
  }
  const journal: MiningJournalRowDTO[] = [];
  for (const [cat, list] of Object.entries(rarityMap)) {
    list.sort((a, b) => a.localeCompare(b));
    journal.push(
      ScmdbMiningJournalRowSchema.parse({
        'Rarity Category': cat,
        'Element List': list.join('\n'),
        'Insight Summary': '',
      }),
    );
  }
  const elements = Object.values(miningData.mineableElements || {});
  const hardest = elements
    .toSorted((a, b) => DIFFICULTY_SCORE[deriveMiningDifficulty(b)] - DIFFICULTY_SCORE[deriveMiningDifficulty(a)])
    .slice(0, 5)
    .map((el) => `${el.name} (${deriveMiningDifficulty(el)})`);
  const volatile = elements
    .toSorted(
      (a, b) =>
        (b.explosionMultiplier ?? 0) +
        (b.instability ?? 0) / 100 -
        ((a.explosionMultiplier ?? 0) + (a.instability ?? 0) / 100),
    )
    .slice(0, 5)
    .map((el) => `${el.name} (${deriveVolatilityNote(el)})`);
  const refineryStandouts = elements
    .map((el) => ({ name: el.name, hint: buildRefineryHint(el.name, miningData) }))
    .filter((entry) => entry.hint)
    .slice(0, 5)
    .map((entry) => `${entry.name}: ${entry.hint}`);
  const insightLines = [
    hardest.length ? `Hardest: ${hardest.join(', ')}` : '',
    volatile.length ? `Most Volatile: ${volatile.join(', ')}` : '',
    refineryStandouts.length ? `Refinery Standouts: ${refineryStandouts.join('; ')}` : '',
  ].filter(Boolean);
  if (insightLines.length) {
    journal.unshift(
      ScmdbMiningJournalRowSchema.parse({
        'Rarity Category': 'Insights',
        'Element List': '',
        'Insight Summary': insightLines.join('\n'),
      }),
    );
  }
  return journal;
}

/** Multiplier used to convert a weight fraction to a one-decimal-place percentage (e.g. 0.123 → 12.3). */
const WEIGHT_TO_PCT_FACTOR = 1000;
/** Divisor that shifts the rounded integer back to one decimal place. */
const PCT_DECIMAL_SHIFT = 10;
/** Divisor to convert a raw quality integer (0–1000) to a percentage with one decimal. */
const QUALITY_PCT_DIVISOR = 10;

/**
 * Converts a map of { mineralName -> totalWeight } into a newline-separated list
 * sorted by descending probability, each entry formatted as "Name — XX.X%".
 * Returns an empty string if the map has no entries.
 *
 * @param weightMap The map of mineral weights
 * @returns Formatted string list
 */
function toWeightedMineableList(weightMap: Record<string, number>): string {
  const entries = Object.entries(weightMap);
  if (entries.length === 0) return '';
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  return entries
    .toSorted((a, b) => b[1] - a[1])
    .map(([name, weight]) => {
      const pct = Math.round((weight / total) * WEIGHT_TO_PCT_FACTOR) / PCT_DECIMAL_SHIFT;
      return `${name} — ${pct}%`;
    })
    .join('\n');
}

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

function addLocationNote(notes: Map<string, string[]>, locations: string[], note: string): void {
  for (const locName of locations) {
    const existing = notes.get(locName) ?? [];
    if (!existing.includes(note)) existing.push(note);
    notes.set(locName, existing);
  }
}

function processOverrideEntries(
  notes: Map<string, string[]>,
  groupEntries: ScmdbLocationOverrideEntryDTO[],
  defaultMin: number,
  groupLabel: string,
  rarityLabel: string,
): void {
  for (const entry of groupEntries) {
    const overrideMin = entry.distribution?.min;
    if (overrideMin === undefined || overrideMin <= defaultMin) continue;
    const floorPct = (overrideMin / QUALITY_PCT_DIVISOR).toFixed(1);
    const defaultPct = (defaultMin / QUALITY_PCT_DIVISOR).toFixed(1);
    const note = `${rarityLabel} ${groupLabel}: quality floor ${floorPct}% (standard ${defaultPct}%)`;
    addLocationNote(notes, entry.locations ?? [], note);
  }
}

/**
 * Scans qualityDistribution.shipmineables for location-specific quality floor overrides.
 * Returns a Map<locationName, string[]> where each string is a human-readable note about
 * an elevated quality floor at that location (only recorded when min > the rarity default).
 *
 * @param qualityDistribution Quality distribution from mining data
 * @returns Map of location to quality notes
 */
export function buildLocationQualityNotes(
  qualityDistribution: MiningDataDTO['qualityDistribution'],
): Map<string, string[]> {
  const notes: Map<string, string[]> = new Map();
  if (!qualityDistribution) return notes;
  const groups = [
    ['shipmineables', 'ship rocks'],
    ['fpsmineables', 'FPS mineables'],
    ['groundmineables', 'ground vehicle mineables'],
    ['harvestables', 'harvestables'],
  ] as const;

  for (const [groupKey, groupLabel] of groups) {
    const distribution = qualityDistribution[groupKey];
    if (!distribution) continue;
    for (const rarity of RARITY_ORDER) {
      const rarityData = distribution[rarity];
      if (!rarityData) continue;
      const defaultMin = rarityData.default?.min ?? null;
      if (defaultMin === null) continue;
      const locationOverrides = rarityData.locationOverrides;
      if (!locationOverrides) continue;
      const rarityLabel = rarity.charAt(0).toUpperCase() + rarity.slice(1);
      for (const groupEntries of Object.values(locationOverrides)) {
        processOverrideEntries(notes, groupEntries, defaultMin, groupLabel, rarityLabel);
      }
    }
  }

  return notes;
}

type MiningType = 'ship' | 'hand' | 'ground';
type LocationWeights = Record<MiningType, Record<string, number>>;

function buildCompNameCache(compositions: MiningDataDTO['compositions']): Record<string, string | null> {
  const cache: Record<string, string | null> = {};
  for (const [id, comp] of Object.entries(compositions || {})) {
    cache[id] = comp.name || null;
  }
  return cache;
}

function classifyMiningGroup(groupName: string): MiningType | null {
  if (groupName.includes('FPS')) return 'hand';
  if (groupName.includes('GroundVehicle')) return 'ground';
  if (groupName.includes('SpaceShip') || groupName.includes('Ship')) return 'ship';
  return null;
}

function accumulateDeposits(
  weights: Record<string, number>,
  deposits: { compositionGuid?: string; relativeProbability?: number }[],
  compNameCache: Record<string, string | null>,
  groupProbability: number,
): void {
  for (const dep of deposits) {
    if (!dep.compositionGuid) continue;
    const compName = compNameCache[dep.compositionGuid];
    if (!compName) continue;
    weights[compName] = (weights[compName] ?? 0) + groupProbability * (dep.relativeProbability ?? 1);
  }
}

// Builds per-location weighted deposit maps.
// Weight = groupProbability * relativeProbability, normalised to % within each mining type.
function buildLocationWeightMaps(
  locations: MiningDataDTO['locations'],
  compNameCache: Record<string, string | null>,
): Record<string, LocationWeights> {
  const weightMaps: Record<string, LocationWeights> = {};
  for (const loc of locations || []) {
    const { locationName: name, groups = [] } = loc;
    if (!weightMaps[name]) {
      weightMaps[name] = { ship: {}, hand: {}, ground: {} };
    }
    for (const group of groups) {
      const miningType = classifyMiningGroup(group.groupName);
      if (!miningType) continue;
      accumulateDeposits(
        weightMaps[name][miningType],
        group.deposits ?? [],
        compNameCache,
        group.groupProbability ?? 1,
      );
    }
  }
  return weightMaps;
}

/**
 * Builds rows for the mining locations CSV.
 */
export function buildMiningLocationRows(miningData: MiningDataDTO): MiningLocationRowDTO[] {
  const compNameCache = buildCompNameCache(miningData.compositions);
  const qualityNotesByLocation = buildLocationQualityNotes(miningData.qualityDistribution);
  const locationWeightMaps = buildLocationWeightMaps(miningData.locations, compNameCache);

  const locRows: MiningLocationRowDTO[] = [];
  for (const [name, weights] of Object.entries(locationWeightMaps)) {
    const shipList = toWeightedMineableList(weights.ship);
    const handList = toWeightedMineableList(weights.hand);
    const groundList = toWeightedMineableList(weights.ground);
    if (shipList || handList || groundList) {
      locRows.push(
        ScmdbMiningLocationRowSchema.parse({
          'Location Name': name,
          'Ship Mineables': shipList,
          'Hand Mineables': handList,
          'Ground Vehicle Mineables': groundList,
          'Quality Note': (qualityNotesByLocation.get(name) ?? []).join('\n'),
        }),
      );
    }
  }
  locRows.sort((a, b) => a['Location Name'].localeCompare(b['Location Name']));
  return locRows;
}
