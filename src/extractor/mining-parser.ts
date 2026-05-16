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
 * Builds rows for the mining locations CSV.
 */
export function buildMiningLocationRows(miningData: MiningDataDTO): Record<string, unknown>[] {
  const compCache: Record<string, string[]> = {};
  for (const [id, comp] of Object.entries(miningData.compositions || {})) {
    const names = new Set<string>();
    for (const part of comp.parts || []) {
      if (part.elementName) names.add(part.elementName);
    }
    compCache[id] = Array.from(names);
  }

  const locations: Record<string, { ship: Set<string>; hand: Set<string> }> = {};
  for (const loc of miningData.locations || []) {
    const name = loc.locationName;
    if (!locations[name]) {
      locations[name] = { ship: new Set(), hand: new Set() };
    }
    for (const group of loc.groups || []) {
      const isHand = group.groupName.includes('FPS');
      const isShip =
        group.groupName.includes('SpaceShip') ||
        group.groupName.includes('GroundVehicle') ||
        group.groupName.includes('Ship');
      if (!isHand && !isShip) continue;

      for (const dep of group.deposits || []) {
        if (!dep.compositionGuid) continue;
        const parts = compCache[dep.compositionGuid] || [];
        for (const p of parts) {
          if (isHand) locations[name].hand.add(p);
          if (isShip) locations[name].ship.add(p);
        }
      }
    }
  }

  const locRows = [];
  for (const [name, dat] of Object.entries(locations)) {
    const shipList = Array.from(dat.ship).sort().join('\n');
    const handList = Array.from(dat.hand).sort().join('\n');
    if (shipList || handList) {
      locRows.push({
        'Location Name': name,
        'Ship Mineables': shipList,
        'Hand Mineables': handList,
      });
    }
  }
  locRows.sort((a, b) => a['Location Name'].localeCompare(b['Location Name']));
  return locRows;
}
