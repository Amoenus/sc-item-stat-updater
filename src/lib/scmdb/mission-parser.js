/**
 * @typedef {Object} CompletionTagDTO
 * @property {string} [tag]
 */

/**
 * @typedef {Object} ContractPrerequisitesDTO
 * @property {Object} [completedContractTags]
 * @property {string[]} [completedContractTags.tags]
 */

/**
 * @typedef {Object} BlueprintRewardEntryDTO
 * @property {string} [blueprintPool]
 * @property {string} [poolName]
 * @property {number} [chance]
 * @property {string} [trigger]
 */

/**
 * @typedef {Object} ScmdbContractDTO
 * @property {string} id
 * @property {string} [debugName]
 * @property {string} [category]
 * @property {string} [missionType]
 * @property {string} [missionTypeKey]
 * @property {string} [title]
 * @property {string} [titleKey]
 * @property {string} [description]
 * @property {string} [descriptionKey]
 * @property {string} [descriptionLocKey]
 * @property {number} [rewardUEC]
 * @property {number} [timeToComplete]
 * @property {boolean} [canBeShared]
 * @property {boolean} [illegal]
 * @property {string} [factionGuid]
 * @property {string[]} [locations]
 * @property {string[]} [destinations]
 * @property {ContractPrerequisitesDTO} [prerequisites]
 * @property {Object.<string, string>} [tokenSubstitutions]
 * @property {Object} [minStanding]
 * @property {Object} [maxStanding]
 * @property {BlueprintRewardEntryDTO[]} [blueprintRewards]
 * @property {CompletionTagDTO[]} [completionTags]
 */

/**
 * @typedef {Object} BlueprintPoolItemDTO
 * @property {string} [name]
 */

/**
 * @typedef {Object} BlueprintPoolDTO
 * @property {string} [name]
 * @property {string} [source]
 * @property {BlueprintPoolItemDTO[]} [blueprints]
 */

/**
 * @typedef {Object} ChainDataDTO
 * @property {Map<string, boolean>} isBlueprintReward
 * @property {Map<string, number>} blueprintChainDepth
 */

/**
 * @typedef {Object} ContractRow
 * @property {string} id
 * @property {string} [debugName]
 * @property {string} [category]
 * @property {string} [missionType]
 * @property {string} [missionTypeKey]
 * @property {string} [title]
 * @property {string} [titleKey]
 * @property {string} [description]
 * @property {string} [descriptionKey]
 * @property {string} [descriptionLocKey]
 * @property {number} [rewardUEC]
 * @property {number} [timeToComplete]
 * @property {boolean} [canBeShared]
 * @property {boolean} [illegal]
 * @property {string} [factionGuid]
 * @property {any} [locations]
 * @property {any} [destinations]
 * @property {any} [prerequisites]
 * @property {any} [tokenSubstitutions]
 * @property {any} [minStanding]
 * @property {any} [maxStanding]
 * @property {any} [blueprintRewards]
 * @property {string} isBlueprintReward
 * @property {string} isBlueprintChainPrerequisite
 * @property {string} blueprintChainDepth
 */

/**
 * Flattens a nested object or array into a string representation.
 * @param {any} value
 * @returns {string}
 */
export function flattenValue(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * Builds rows for contracts CSV.
 * @param {ScmdbContractDTO} contract
 * @param {ChainDataDTO} chainData
 * @returns {ContractRow}
 */
export function buildContractRow(contract, chainData) {
  const isBlueprintReward = chainData.isBlueprintReward.get(contract.id) === true;
  const depth = chainData.blueprintChainDepth.get(contract.id);
  return {
    id: contract.id,
    debugName: contract.debugName,
    category: contract.category,
    missionType: contract.missionType,
    missionTypeKey: contract.missionTypeKey,
    title: contract.title,
    titleKey: contract.titleKey,
    description: contract.description,
    descriptionKey: contract.descriptionKey,
    descriptionLocKey: contract.descriptionLocKey,
    rewardUEC: contract.rewardUEC,
    timeToComplete: contract.timeToComplete,
    canBeShared: contract.canBeShared,
    illegal: contract.illegal,
    factionGuid: contract.factionGuid,
    locations: flattenValue(contract.locations),
    destinations: flattenValue(contract.destinations),
    prerequisites: flattenValue(contract.prerequisites),
    tokenSubstitutions: flattenValue(contract.tokenSubstitutions),
    minStanding: flattenValue(contract.minStanding),
    maxStanding: flattenValue(contract.maxStanding),
    blueprintRewards: flattenValue(contract.blueprintRewards),
    isBlueprintReward: isBlueprintReward ? 'true' : 'false',
    isBlueprintChainPrerequisite: depth > 0 ? 'true' : 'false',
    blueprintChainDepth: depth !== undefined ? String(depth) : '',
  };
}

/**
 * @typedef {Object} MissionRow
 * @property {string} ["Localization Key"]
 * @property {string} [Description]
 * @property {string} [TitleNote]
 * @property {string} [Note]
 * @property {string} [RewardList]
 */

function normalizeLocalizationKey(key) {
  if (!key || typeof key !== 'string') return '';
  let normalized = key;
  if (normalized.startsWith('@')) normalized = normalized.substring(1);
  return normalized;
}

function buildBlueprintRewardList(contract, blueprintPools) {
  if (!Array.isArray(contract.blueprintRewards)) return '';

  const formatChance = (chance) => {
    const numericChance = Number(chance);
    if (!Number.isFinite(numericChance)) {
      return null;
    }
    return `${Math.round(numericChance * 100)}% chance`;
  };

  const sections = [];
  for (const entry of contract.blueprintRewards) {
    const pool = blueprintPools?.[entry.blueprintPool];
    if (!pool || !Array.isArray(pool.blueprints)) continue;

    const itemNames = pool.blueprints
      .map((blueprint) => (blueprint && typeof blueprint.name === 'string' ? blueprint.name : null))
      .filter(Boolean);

    if (itemNames.length === 0) {
      continue;
    }

    const chanceText = formatChance(entry.chance);
    const oneOfText = `1 of ${itemNames.length}`;
    const details = chanceText ? `${chanceText} — ${oneOfText}` : oneOfText;
    const itemLines = itemNames.map((name) => `- ${name}`).join(String.raw`\n`);
    sections.push([details, itemLines].join(String.raw`\n`));
  }

  return sections.join(String.raw`\n\n`);
}

/**
 * Builds rows for mission output CSV.
 * @param {ScmdbContractDTO[]} contracts
 * @param {ChainDataDTO} chainData
 * @param {Object.<string, BlueprintPoolDTO>} blueprintPools
 * @returns {MissionRow[]}
 */
export function buildMissionRows(contracts, chainData, blueprintPools) {
  return (contracts || [])
    .flatMap((contract) => {
      const rows = [];
      const blueprintReward = chainData.isBlueprintReward.get(contract.id) === true;
      const blueprintChain = chainData.blueprintChainDepth.get(contract.id) > 0;
      const titleKey = normalizeLocalizationKey(contract.titleKey || '');
      const descKey = normalizeLocalizationKey(contract.descriptionLocKey || contract.descriptionKey || '');
      let titleTag = '';
      let descTag = '';
      if (blueprintReward) {
        titleTag = ' <EM4>[BP]</EM4>';
        descTag = '[BP Reward]';
      } else if (blueprintChain) {
        titleTag = ' <EM4>[BP Chain]</EM4>';
        descTag = '[BP Chain]';
      }
      const rewardList = blueprintReward ? buildBlueprintRewardList(contract, blueprintPools) : '';
      const descriptionNote = descTag;

      if (titleKey && contract.title) {
        rows.push({
          'Localization Key': titleKey,
          Description: contract.title,
          TitleNote: titleTag,
          Note: '',
          RewardList: '',
        });
      }

      if (descKey && contract.description) {
        rows.push({
          'Localization Key': descKey,
          Description: contract.description,
          Note: descriptionNote,
          TitleNote: '',
          RewardList: rewardList,
        });
      }

      return rows;
    })
    .filter(Boolean);
}

/**
 * Collects chain data for blueprint prerequisite resolution.
 * @param {ScmdbContractDTO[]} contracts
 * @returns {ChainDataDTO}
 */
export function collectBlueprintChainData(contracts) {
  const contractById = new Map(contracts.map((contract) => [contract.id, contract]));
  const tagProviders = new Map();

  for (const contract of contracts) {
    if (!Array.isArray(contract.completionTags)) continue;
    for (const completionTag of contract.completionTags) {
      const tag = completionTag?.tag;
      if (typeof tag !== 'string') continue;
      const list = tagProviders.get(tag) ?? [];
      list.push(contract.id);
      tagProviders.set(tag, list);
    }
  }

  const isBlueprintReward = new Map();
  const blueprintChainDepth = new Map();

  const queue = [];

  const getRequiredTags = (contract) => {
    const prerequisites = contract.prerequisites;
    if (!prerequisites || typeof prerequisites !== 'object') return [];
    const completedTags = prerequisites.completedContractTags;
    if (!completedTags || typeof completedTags !== 'object') return [];
    return Array.isArray(completedTags.tags) ? completedTags.tags.filter((tag) => typeof tag === 'string') : [];
  };

  for (const contract of contracts) {
    const reward = Array.isArray(contract.blueprintRewards) && contract.blueprintRewards.length > 0;
    if (reward) {
      isBlueprintReward.set(contract.id, true);
      blueprintChainDepth.set(contract.id, 0);
      const requiredTags = getRequiredTags(contract);
      for (const tag of requiredTags) {
        for (const providerId of tagProviders.get(tag) ?? []) {
          queue.push({ contractId: providerId, depth: 1 });
        }
      }
    }
  }

  while (queue.length > 0) {
    const { contractId, depth } = queue.shift();
    const currentDepth = blueprintChainDepth.get(contractId);
    if (currentDepth !== undefined && currentDepth <= depth) {
      continue;
    }
    blueprintChainDepth.set(contractId, depth);
    const contract = contractById.get(contractId);
    if (!contract) continue;
    const requiredTags = getRequiredTags(contract);
    for (const tag of requiredTags) {
      for (const providerId of tagProviders.get(tag) ?? []) {
        if (providerId === contractId) continue;
        queue.push({ contractId: providerId, depth: depth + 1 });
      }
    }
  }

  return { isBlueprintReward, blueprintChainDepth };
}

/**
 * Builds rows for Blueprint Pools CSV.
 * @param {Object.<string, BlueprintPoolDTO>} blueprintPools
 * @returns {any[]}
 */
export function buildBlueprintPoolRows(blueprintPools) {
  return Object.entries(blueprintPools || {}).map(([id, pool]) => ({
    id,
    name: pool.name,
    source: pool.source,
    blueprints: flattenValue(pool.blueprints),
  }));
}

/**
 * Builds rows for Contract Blueprint Rewards CSV.
 * @param {ScmdbContractDTO[]} contracts
 * @param {Object.<string, BlueprintPoolDTO>} blueprintPools
 * @returns {any[]}
 */
export function buildContractBlueprintRows(contracts, blueprintPools) {
  return (contracts || []).flatMap((contract) => {
    if (!Array.isArray(contract.blueprintRewards)) return [];
    return contract.blueprintRewards.map((entry) => ({
      contractId: contract.id,
      debugName: contract.debugName,
      title: contract.title,
      blueprintPoolId: entry.blueprintPool,
      poolName: entry.poolName,
      chance: entry.chance,
      trigger: entry.trigger,
      blueprintSource: blueprintPools?.[entry.blueprintPool]?.source,
      blueprintItems: flattenValue(blueprintPools?.[entry.blueprintPool]?.blueprints),
    }));
  });
}
