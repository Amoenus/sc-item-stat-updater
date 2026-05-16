import type {
  ScmdbBlueprintPoolDTO as BlueprintPoolDTO,
  ScmdbContractDTO as ContractDTO,
} from '../schema/scmdb.schemas.js';

interface ChainDataDTO {
  isBlueprintReward: Map<string, boolean>;
  blueprintChainDepth: Map<string, number>;
}

/**
 * Flattens a value into a string.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function flattenValue(value: any): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * Collects chain data for blueprint missions.
 */
export function collectBlueprintChainData(contracts: ContractDTO[]): ChainDataDTO {
  const contractById = new Map(contracts.map((contract) => [contract.id, contract]));
  const tagProviders = new Map<string, string[]>();

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

  const isBlueprintReward = new Map<string, boolean>();
  const blueprintChainDepth = new Map<string, number>();

  const queue: Array<{ contractId: string; depth: number }> = [];

  const getRequiredTags = (contract: ContractDTO): string[] => {
    const prerequisites = contract.prerequisites;
    if (!prerequisites || typeof prerequisites !== 'object') return [];
    const completedTags = prerequisites.completedContractTags;
    if (!completedTags || typeof completedTags !== 'object') return [];
    return Array.isArray(completedTags.tags)
      ? completedTags.tags.filter((tag): tag is string => typeof tag === 'string')
      : [];
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
    const item = queue.shift();
    if (!item) continue;
    const { contractId, depth } = item;
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
 * Builds a contract row.
 */
export function buildContractRow(contract: ContractDTO, chainData: ChainDataDTO): Record<string, unknown> {
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
    isBlueprintChainPrerequisite: depth !== undefined && depth > 0 ? 'true' : 'false',
    blueprintChainDepth: depth !== undefined ? String(depth) : '',
  };
}

/**
 * Builds blueprint pool rows.
 */
export function buildBlueprintPoolRows(
  blueprintPools: Record<string, BlueprintPoolDTO> | null | undefined,
): Record<string, unknown>[] {
  return Object.entries(blueprintPools || {}).map(([id, pool]) => ({
    id,
    name: pool.name,
    source: pool.source,
    blueprints: flattenValue(pool.blueprints),
  }));
}

/**
 * Builds contract blueprint rows.
 */
export function buildContractBlueprintRows(
  contracts: ContractDTO[],
  blueprintPools: Record<string, BlueprintPoolDTO> | null | undefined,
): Record<string, unknown>[] {
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
      blueprintSource: entry.blueprintPool ? blueprintPools?.[entry.blueprintPool]?.source : undefined,
      blueprintItems: entry.blueprintPool ? flattenValue(blueprintPools?.[entry.blueprintPool]?.blueprints) : '',
    }));
  });
}

/**
 * Builds a blueprint reward list.
 */
export function buildBlueprintRewardList(
  contract: ContractDTO,
  blueprintPools: Record<string, BlueprintPoolDTO> | null | undefined,
): string {
  if (!Array.isArray(contract.blueprintRewards)) return '';

  const formatChance = (chance: number | undefined): string | null => {
    const numericChance = Number(chance);
    if (!Number.isFinite(numericChance)) {
      return null;
    }
    return `${Math.round(numericChance * 100)}% chance`;
  };

  const sections = [];
  for (const entry of contract.blueprintRewards) {
    const pool = entry.blueprintPool ? blueprintPools?.[entry.blueprintPool] : undefined;
    if (!pool || !Array.isArray(pool.blueprints)) continue;

    const itemNames = pool.blueprints
      .map((blueprint) => (blueprint && typeof blueprint.name === 'string' ? blueprint.name : null))
      .filter((n: string | null): n is string => Boolean(n));

    if (itemNames.length === 0) {
      continue;
    }

    const chanceText = formatChance(entry.chance ?? undefined);
    const oneOfText = `1 of ${itemNames.length}`;
    const details = chanceText ? `${chanceText} — ${oneOfText}` : oneOfText;
    const itemLines = itemNames.map((name: string) => `- ${name}`).join(String.raw`\n`);
    sections.push([details, itemLines].join(String.raw`\n`));
  }

  return sections.join(String.raw`\n\n`);
}

/**
 * Normalizes a localization key.
 */
export function normalizeLocalizationKey(key: string): string {
  if (!key || typeof key !== 'string') return '';
  return key.startsWith('@') ? key.slice(1) : key;
}

/**
 * Builds mission rows.
 */
export function buildMissionRows(
  contracts: ContractDTO[],
  chainData: ChainDataDTO,
  blueprintPools: Record<string, BlueprintPoolDTO> | null | undefined,
): Record<string, unknown>[] {
  return (contracts || [])
    .flatMap((contract) => {
      const rows: Record<string, unknown>[] = [];
      const blueprintReward = chainData.isBlueprintReward.get(contract.id) === true;
      const blueprintChain = (chainData.blueprintChainDepth.get(contract.id) ?? 0) > 0;
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
