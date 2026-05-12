/**
 * @typedef {Object} MiningElementDTO
 * @property {string} name
 * @property {string} rarity
 * @property {number} groundScanSignature
 * @property {number} scanSignature
 * @property {number} resistance
 * @property {number} instability
 */

/**
 * @typedef {Object} MiningCompositionPartDTO
 * @property {string} elementName
 */

/**
 * @typedef {Object} MiningCompositionDTO
 * @property {MiningCompositionPartDTO[]} parts
 */

/**
 * @typedef {Object} MiningDepositDTO
 * @property {string} compositionGuid
 */

/**
 * @typedef {Object} MiningGroupDTO
 * @property {string} groupName
 * @property {MiningDepositDTO[]} deposits
 */

/**
 * @typedef {Object} MiningLocationDTO
 * @property {string} locationName
 * @property {MiningGroupDTO[]} groups
 */

/**
 * @typedef {Object} MiningDataDTO
 * @property {Object.<string, MiningElementDTO>} [mineableElements]
 * @property {Object.<string, MiningCompositionDTO>} [compositions]
 * @property {MiningLocationDTO[]} [locations]
 */

/**
 * @typedef {Object} MiningElementRow
 * @property {string} ["Element Name"]
 * @property {string} [Rarity]
 * @property {number} ["Ground Scan Signature"]
 * @property {number} ["Scan Signature"]
 * @property {number} [Resistance]
 * @property {number} [Instability]
 */

/**
 * Builds rows for the mining elements CSV.
 * @param {MiningDataDTO} miningData
 * @returns {MiningElementRow[]}
 */
export function buildMiningElementRows(miningData) {
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
 * @typedef {Object} MiningJournalRow
 * @property {string} ["Rarity Category"]
 * @property {string} ["Element List"]
 */

/**
 * Builds rows for the mining journal CSV.
 * @param {MiningDataDTO} miningData
 * @returns {MiningJournalRow[]}
 */
export function buildMiningJournalRows(miningData) {
  const rarityMap = {};
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
 * @typedef {Object} MiningLocationRow
 * @property {string} ["Location Name"]
 * @property {string} ["Ship Mineables"]
 * @property {string} ["Hand Mineables"]
 */

/**
 * Builds rows for the mining locations CSV.
 * @param {MiningDataDTO} miningData
 * @returns {MiningLocationRow[]}
 */
export function buildMiningLocationRows(miningData) {
  const compCache = {};
  for (const [id, comp] of Object.entries(miningData.compositions || {})) {
    const names = new Set();
    for (const part of comp.parts || []) {
      if (part.elementName) names.add(part.elementName);
    }
    compCache[id] = Array.from(names);
  }

  const locations = {};
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
