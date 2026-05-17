import type { ScmdbMiningDataDTO as MiningDataDTO } from '../schema/scmdb.schemas.js';

/**
 * Builds rows for the mining elements CSV.
 */
export function buildMiningElementRows(miningData: MiningDataDTO): Record<string, unknown>[] {
  const elements = [];
  for (const [_id, el] of Object.entries(miningData.mineableElements || {})) {
    elements.push({
      'Element Name': el.name,
      Rarity: el.rarity,
      'Ground Scan Signature': el.groundScanSignature,
      'Scan Signature': el.scanSignature,
      Resistance: el.resistance,
      Instability: el.instability,
    });
  }
  return elements;
}

/**
 * Builds rows for the mining journal CSV.
 */
export function buildMiningJournalRows(miningData: MiningDataDTO): Record<string, unknown>[] {
  const rarityMap: Record<string, string[]> = {};
  for (const el of Object.values(miningData.mineableElements || {})) {
    const rarity = (el.rarity || 'Unknown').toLowerCase();
    const cat = rarity.charAt(0).toUpperCase() + rarity.slice(1);
    if (!rarityMap[cat]) rarityMap[cat] = [];
    rarityMap[cat].push(el.name);
  }
  const journal = [];
  for (const [cat, list] of Object.entries(rarityMap)) {
    list.sort();
    journal.push({
      'Rarity Category': cat,
      'Element List': list.join('\n'),
    });
  }
  return journal;
}

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
    .sort((a, b) => b[1] - a[1])
    .map(([name, weight]) => {
      const pct = Math.round((weight / total) * 1000) / 10;
      return `${name} — ${pct}%`;
    })
    .join('\n');
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

  const sm = qualityDistribution?.shipmineables;
  if (!sm) return notes;

  const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

  for (const rarity of RARITY_ORDER) {
    const rarityData = sm[rarity];
    if (!rarityData) continue;

    const defaultMin = rarityData.default?.min ?? null;
    if (defaultMin === null) continue;

    const locationOverrides = rarityData.locationOverrides;
    if (!locationOverrides) continue;

    for (const groupEntries of Object.values(locationOverrides)) {
      for (const entry of groupEntries) {
        const overrideMin = entry.distribution?.min;
        if (overrideMin === undefined || overrideMin <= defaultMin) continue;

        // This location group has an elevated quality floor
        const floorPct = (overrideMin / 10).toFixed(1);
        const defaultPct = (defaultMin / 10).toFixed(1);
        const label = rarity.charAt(0).toUpperCase() + rarity.slice(1);
        const note = `${label} ship rocks: quality floor ${floorPct}% (standard ${defaultPct}%)`;

        for (const locName of entry.locations ?? []) {
          const existing = notes.get(locName) ?? [];
          if (!existing.includes(note)) existing.push(note);
          notes.set(locName, existing);
        }
      }
    }
  }

  return notes;
}

/**
 * Builds rows for the mining locations CSV.
 */
export function buildMiningLocationRows(miningData: MiningDataDTO): Record<string, unknown>[] {
  // Map compositionGuid -> composition name (the primary mineral label for that deposit type)
  const compNameCache: Record<string, string | null> = {};
  for (const [id, comp] of Object.entries(miningData.compositions || {})) {
    compNameCache[id] = comp.name || null;
  }

  // Build per-location quality override notes.
  const qualityNotesByLocation = buildLocationQualityNotes(miningData.qualityDistribution);

  // Build per-location weighted deposit maps.
  // Weight = groupProbability * relativeProbability, then normalised to % within each mining type.
  const locationData: Record<
    string,
    { ship: Record<string, number>; hand: Record<string, number>; ground: Record<string, number> }
  > = {};

  for (const loc of miningData.locations || []) {
    const name = loc.locationName;
    if (!locationData[name]) {
      locationData[name] = { ship: {}, hand: {}, ground: {} };
    }
    for (const group of loc.groups || []) {
      const isHand = group.groupName.includes('FPS');
      const isGround = group.groupName.includes('GroundVehicle');
      const isShip =
        !isHand && !isGround && (group.groupName.includes('SpaceShip') || group.groupName.includes('Ship'));
      if (!isHand && !isGround && !isShip) continue;

      const target = isHand ? locationData[name].hand : isGround ? locationData[name].ground : locationData[name].ship;

      const gp = group.groupProbability ?? 1;
      for (const dep of group.deposits || []) {
        if (!dep.compositionGuid) continue;
        const compName = compNameCache[dep.compositionGuid];
        if (!compName) continue;
        const weight = gp * (dep.relativeProbability ?? 1);
        target[compName] = (target[compName] ?? 0) + weight;
      }
    }
  }

  const locRows = [];
  for (const [name, dat] of Object.entries(locationData)) {
    const shipList = toWeightedMineableList(dat.ship);
    const handList = toWeightedMineableList(dat.hand);
    const groundList = toWeightedMineableList(dat.ground);
    if (shipList || handList || groundList) {
      locRows.push({
        'Location Name': name,
        'Ship Mineables': shipList,
        'Hand Mineables': handList,
        'Ground Vehicle Mineables': groundList,
        'Quality Note': (qualityNotesByLocation.get(name) ?? []).join('\n'),
      });
    }
  }
  locRows.sort((a, b) => String(a['Location Name']).localeCompare(String(b['Location Name'])));
  return locRows;
}
