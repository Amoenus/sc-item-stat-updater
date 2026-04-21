/**
 * Flattens a scmdb.net merged.json payload into tabular projections suitable
 * for CSV output and downstream joins. The raw payload has nested objects
 * (minStanding, blueprintRewards, prerequisites, etc.) that are either
 * squashed into pipe-joined strings or emitted as separate long-format tables.
 */

const pipeJoin = (arr) => (Array.isArray(arr) ? arr.filter(Boolean).join('|') : '');

/**
 * One row per contract, merging `contracts` and `legacyContracts` with an
 * `isLegacy` flag. Nested fields are either flattened (minStanding.name,
 * factionName) or collapsed (systems, blueprintPoolNames).
 *
 * @param {object} payload
 * @returns {Array<Record<string, string | number | boolean | null>>}
 */
export function flattenContracts(payload) {
  const factions = payload.factions ?? {};
  const contracts = [
    ...(payload.contracts ?? []).map((c) => ({ ...c, isLegacy: false })),
    ...(payload.legacyContracts ?? []).map((c) => ({ ...c, isLegacy: true })),
  ];

  return contracts.map((c) => {
    const bp = Array.isArray(c.blueprintRewards) ? c.blueprintRewards : [];
    return {
      id: c.id ?? '',
      debugName: c.debugName ?? '',
      isLegacy: c.isLegacy,
      category: c.category ?? '',
      missionType: c.missionType ?? '',
      illegal: c.illegal ?? false,
      onceOnly: c.onceOnly ?? false,
      canBeShared: c.canBeShared ?? false,
      hideInMobiGlas: c.hideInMobiGlas ?? false,
      availableInPrison: c.availableInPrison ?? false,
      titleLocKey: c.titleLocKey ?? '',
      descriptionLocKey: c.descriptionLocKey ?? '',
      title: c.title ?? '',
      description: c.description ?? '',
      factionGuid: c.factionGuid ?? '',
      factionName: factions[c.factionGuid]?.name ?? '',
      rewardUEC: c.rewardUEC ?? '',
      rewardIsDynamic: c.rewardIsDynamic ?? '',
      buyIn: c.buyIn ?? '',
      timeToComplete: c.timeToComplete ?? '',
      maxPlayersPerInstance: c.maxPlayersPerInstance ?? '',
      personalCooldownTime: c.personalCooldownTime ?? '',
      minStandingName: c.minStanding?.name ?? '',
      minStandingNameKey: c.minStanding?.nameKey ?? '',
      minStandingScope: c.minStanding?.scopeName ?? '',
      maxStandingName: c.maxStanding?.name ?? '',
      maxStandingNameKey: c.maxStanding?.nameKey ?? '',
      systems: pipeJoin(c.systems),
      blueprintRewardsCount: bp.length,
      blueprintPoolNames: pipeJoin(bp.map((r) => r.poolName)),
      blueprintPoolGuids: pipeJoin(bp.map((r) => r.blueprintPool)),
      blueprintChances: pipeJoin(bp.map((r) => r.chance)),
      shipEncountersCount: Array.isArray(c.shipEncounters) ? c.shipEncounters.length : 0,
      haulingOrdersCount: Array.isArray(c.haulingOrders) ? c.haulingOrders.length : 0,
      locationCount: Array.isArray(c.locations) ? c.locations.length : 0,
      destinationCount: Array.isArray(c.destinations) ? c.destinations.length : 0,
    };
  });
}

/**
 * Long-format blueprint pool table — one row per (pool, blueprint) pair.
 * Joins back to contracts via `blueprintPoolGuids`.
 *
 * @param {object} payload
 */
export function flattenBlueprintPools(payload) {
  const rows = [];
  for (const [guid, pool] of Object.entries(payload.blueprintPools ?? {})) {
    const items = Array.isArray(pool.blueprints) ? pool.blueprints : [];
    if (items.length === 0) {
      rows.push({ blueprintPoolGuid: guid, poolName: pool.name ?? '', blueprintName: '', weight: '' });
      continue;
    }
    for (const bp of items) {
      rows.push({
        blueprintPoolGuid: guid,
        poolName: pool.name ?? '',
        blueprintName: bp.name ?? '',
        weight: bp.weight ?? '',
      });
    }
  }
  return rows;
}

/**
 * One row per faction.
 *
 * @param {object} payload
 */
export function flattenFactions(payload) {
  return Object.entries(payload.factions ?? {}).map(([guid, f]) => ({
    guid,
    name: f.name ?? '',
    nameKey: f.nameKey ?? '',
    isNPC: f.isNPC ?? '',
    logo: f.logo ?? '',
  }));
}

/**
 * One row per location pool (maps scmdb's 12-char location IDs to names/types).
 *
 * @param {object} payload
 */
export function flattenLocationPools(payload) {
  return Object.entries(payload.locationPools ?? {}).map(([id, loc]) => ({
    id,
    name: loc.name ?? '',
    type: loc.type ?? '',
    system: loc.system ?? '',
    planet: loc.planet ?? '',
    moon: loc.moon ?? '',
  }));
}

/**
 * One row per resource pool entry.
 *
 * @param {object} payload
 */
export function flattenResourcePools(payload) {
  return Object.entries(payload.resourcePools ?? {}).map(([id, r]) => ({
    id,
    name: r.name ?? '',
    nameKey: r.nameKey ?? '',
  }));
}

/**
 * Long-format ship pool table — one row per (pool, ship) pair.
 *
 * @param {object} payload
 */
export function flattenShipPools(payload) {
  const rows = [];
  for (const [id, ships] of Object.entries(payload.shipPools ?? {})) {
    const arr = Array.isArray(ships) ? ships : [];
    if (arr.length === 0) {
      rows.push({ shipPoolId: id, shipName: '' });
      continue;
    }
    for (const s of arr) rows.push({ shipPoolId: id, shipName: s });
  }
  return rows;
}
