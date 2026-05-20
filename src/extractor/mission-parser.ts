import { IniTag } from '../lib/ini-tags';
import type {
  ScmdbBlueprintPoolsDTO as BlueprintPoolsDTO,
  ScmdbContractDTO as ContractDTO,
  ScmdbFactionDTO as FactionDTO,
  ScmdbFactionRewardsDTO as FactionRewardsDTO,
  ScmdbLegacyContractDTO as LegacyContractDTO,
} from '../schema/scmdb.schemas';

/**
 * Normalized shape that buildContractRow requires.
 * Both Contract and LegacyContract are adapted to this interface via
 * toContractRowSource / toLegacyContractRowSource before row building.
 */
export interface ContractRowSource {
  id: string;
  debugName: string | null | undefined;
  category: string | null | undefined;
  missionType: string | null | undefined;
  missionTypeKey: string | null | undefined;
  title: string | null | undefined;
  titleKey: string | null | undefined;
  description: string | null | undefined;
  descriptionKey: string | null | undefined;
  descriptionLocKey: string | null | undefined;
  rewardUEC: number | null | undefined;
  timeToComplete: number | null | undefined;
  canBeShared: boolean | null | undefined;
  illegal: boolean | null | undefined;
  factionGuid: string | null | undefined;
  locations: unknown;
  destinations: unknown;
  prerequisites: unknown;
  tokenSubstitutions: unknown;
  minStanding: unknown;
  maxStanding: unknown;
  blueprintRewards: unknown;
  personalCooldownTime: number | null | undefined;
  rewardRepCalculated: number | null | undefined;
  factionRewardsIndex: number | null | undefined;
  shipEncounters: unknown;
}

/** Adapts a quicktype Contract to ContractRowSource. */
export function toContractRowSource(contract: ContractDTO): ContractRowSource {
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
    locations: contract.locations,
    destinations: contract.destinations,
    prerequisites: contract.prerequisites,
    tokenSubstitutions: contract.tokenSubstitutions,
    minStanding: contract.minStanding,
    maxStanding: contract.maxStanding,
    blueprintRewards: contract.blueprintRewards,
    personalCooldownTime: contract.personalCooldownTime,
    rewardRepCalculated: contract.rewardRepCalculated,
    factionRewardsIndex: contract.factionRewardsIndex,
    shipEncounters: contract.shipEncounters,
  };
}

/** Adapts a quicktype LegacyContract to ContractRowSource. */
export function toLegacyContractRowSource(contract: LegacyContractDTO): ContractRowSource {
  return {
    id: contract.id,
    debugName: contract.debugName,
    category: undefined,
    missionType: contract.missionType,
    missionTypeKey: undefined,
    title: contract.title,
    titleKey: contract.titleKey,
    description: contract.description,
    descriptionKey: contract.descriptionKey,
    descriptionLocKey: contract.descriptionLocKey,
    rewardUEC: contract.rewardUEC,
    timeToComplete: undefined,
    canBeShared: contract.canBeShared,
    illegal: contract.illegal,
    factionGuid: contract.factionGuid,
    locations: contract.locations,
    destinations: contract.destinations,
    prerequisites: contract.prerequisites,
    tokenSubstitutions: contract.tokenSubstitutions,
    minStanding: contract.minStanding,
    maxStanding: undefined,
    blueprintRewards: undefined,
    personalCooldownTime: contract.personalCooldownTime,
    rewardRepCalculated: undefined,
    factionRewardsIndex: contract.factionRewardsIndex,
    shipEncounters: undefined,
  };
}

interface ChainDataDTO {
  isBlueprintReward: Map<string, boolean>;
  blueprintChainDepth: Map<string, number>;
}

export interface FactionRewardsContext {
  factionRewards: Map<string, string>;
  factionRewardsRaw: Map<string, string>;
}

/**
 * Flattens a value into a string.
 */
export function flattenValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function buildTagProviders(contracts: ContractDTO[]): Map<string, string[]> {
  const tagProviders = new Map<string, string[]>();
  for (const contract of contracts) {
    if (!contract.completionTags) continue;
    for (const completionTag of contract.completionTags) {
      const tag = completionTag.tag;
      const list = tagProviders.get(tag) ?? [];
      list.push(contract.id);
      tagProviders.set(tag, list);
    }
  }
  return tagProviders;
}

function getRequiredTags(contract: ContractDTO): string[] {
  return contract.prerequisites.completedContractTags?.tags ?? [];
}

function seedBlueprintQueue(
  contracts: ContractDTO[],
  tagProviders: Map<string, string[]>,
  isBlueprintReward: Map<string, boolean>,
  blueprintChainDepth: Map<string, number>,
): Array<{ contractId: string; depth: number }> {
  const queue: Array<{ contractId: string; depth: number }> = [];
  for (const contract of contracts) {
    if (!contract.blueprintRewards || contract.blueprintRewards.length === 0) continue;
    isBlueprintReward.set(contract.id, true);
    blueprintChainDepth.set(contract.id, 0);
    for (const tag of getRequiredTags(contract)) {
      for (const providerId of tagProviders.get(tag) ?? []) {
        queue.push({ contractId: providerId, depth: 1 });
      }
    }
  }
  return queue;
}

function enqueuePrerequisites(
  contractId: string,
  depth: number,
  contract: ContractDTO,
  tagProviders: Map<string, string[]>,
  queue: Array<{ contractId: string; depth: number }>,
): void {
  for (const tag of getRequiredTags(contract)) {
    for (const providerId of tagProviders.get(tag) ?? []) {
      if (providerId === contractId) continue;
      queue.push({ contractId: providerId, depth: depth + 1 });
    }
  }
}

function propagateChainDepths(
  queue: Array<{ contractId: string; depth: number }>,
  contractById: Map<string, ContractDTO>,
  blueprintChainDepth: Map<string, number>,
  tagProviders: Map<string, string[]>,
): void {
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;
    const { contractId, depth } = item;
    const currentDepth = blueprintChainDepth.get(contractId);
    if (currentDepth !== undefined && currentDepth <= depth) continue;
    blueprintChainDepth.set(contractId, depth);
    const contract = contractById.get(contractId);
    if (!contract) continue;
    enqueuePrerequisites(contractId, depth, contract, tagProviders, queue);
  }
}

function buildFactionRewardsString(
  pool: FactionRewardsDTO[],
  factionNames: Map<string, string>,
): string {
  return pool
    .map(({ factionGuid, amount }) => {
      const name = factionNames.get(factionGuid) ?? factionGuid;
      const sign = amount >= 0 ? '+' : '';
      return `${name}: ${sign}${amount}`;
    })
    .join(String.raw`\n`);
}

/**
 * Pre-computes faction reputation reward strings for all contracts.
 */
export function buildFactionRewardsContext(
  factionRewardsPools: FactionRewardsDTO[][],
  factions: Record<string, FactionDTO>,
  contracts: ContractDTO[],
): FactionRewardsContext {
  const factionNames = new Map<string, string>();
  for (const [guid, faction] of Object.entries(factions)) {
    if (faction.name) factionNames.set(guid, faction.name);
  }

  const factionRewards = new Map<string, string>();
  const factionRewardsRaw = new Map<string, string>();

  for (const contract of contracts) {
    const index = contract.factionRewardsIndex;
    if (index == null || index === 0) continue;
    const pool = factionRewardsPools[index];
    if (!pool || pool.length === 0) continue;
    factionRewards.set(contract.id, buildFactionRewardsString(pool, factionNames));
    factionRewardsRaw.set(
      contract.id,
      JSON.stringify(pool.map(({ factionGuid, amount }) => ({ factionGuid, amount }))),
    );
  }

  return { factionRewards, factionRewardsRaw };
}

/**
 * Collects chain data for blueprint missions.
 */
export function collectBlueprintChainData(contracts: ContractDTO[]): ChainDataDTO {
  const contractById = new Map(contracts.map((contract) => [contract.id, contract]));
  const tagProviders = buildTagProviders(contracts);
  const isBlueprintReward = new Map<string, boolean>();
  const blueprintChainDepth = new Map<string, number>();
  const queue = seedBlueprintQueue(contracts, tagProviders, isBlueprintReward, blueprintChainDepth);
  propagateChainDepths(queue, contractById, blueprintChainDepth, tagProviders);
  return { isBlueprintReward, blueprintChainDepth };
}

/**
 * Builds a contract row.
 */
export function buildContractRow(
  contract: ContractRowSource,
  chainData: ChainDataDTO,
  factionRewardsContext: FactionRewardsContext,
): Record<string, unknown> {
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
    blueprintChainDepth: depth === undefined ? '' : String(depth),
    personalCooldownTime: contract.personalCooldownTime,
    rewardRepCalculated: contract.rewardRepCalculated,
    factionRewards: factionRewardsContext.factionRewards.get(contract.id) ?? '',
    factionRewardsRaw: factionRewardsContext.factionRewardsRaw.get(contract.id) ?? '',
    shipEncounters: flattenValue(contract.shipEncounters),
  };
}

/**
 * Builds blueprint pool rows.
 */
export function buildBlueprintPoolRows(
  blueprintPools: BlueprintPoolsDTO,
): Record<string, unknown>[] {
  return Object.entries(blueprintPools).map(([id, pool]) => ({
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
  blueprintPools: BlueprintPoolsDTO,
): Record<string, unknown>[] {
  return contracts.flatMap((contract) => {
    if (!contract.blueprintRewards) return [];
    return contract.blueprintRewards.map((entry) => ({
      contractId: contract.id,
      debugName: contract.debugName,
      title: contract.title,
      blueprintPoolId: entry.blueprintPool,
      poolName: entry.poolName,
      chance: entry.chance,
      trigger: entry.trigger,
      blueprintSource: blueprintPools[entry.blueprintPool]?.source,
      blueprintItems: flattenValue(blueprintPools[entry.blueprintPool]?.blueprints),
    }));
  });
}

/**
 * Builds a blueprint reward list.
 */
export function buildBlueprintRewardList(
  contract: ContractDTO,
  blueprintPools: BlueprintPoolsDTO,
): string {
  if (!contract.blueprintRewards) return '';

  const formatChance = (chance: number): string | null => {
    if (!Number.isFinite(chance)) return null;
    return `${Math.round(chance * 100)}% chance`;
  };

  const sections = [];
  for (const entry of contract.blueprintRewards) {
    const pool = blueprintPools[entry.blueprintPool];
    if (!pool) continue;

    const itemNames = pool.blueprints
      .map((blueprint) => blueprint.name ?? null)
      .filter((n): n is string => Boolean(n));

    if (itemNames.length === 0) continue;

    const chanceText = formatChance(entry.chance);
    const oneOfText = `1 of ${itemNames.length}`;
    const details = chanceText ? `${chanceText} — ${oneOfText}` : oneOfText;
    const itemLines = itemNames.map((name) => `- ${name}`).join(String.raw`\n`);
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
  blueprintPools: BlueprintPoolsDTO,
): Record<string, unknown>[] {
  return contracts
    .flatMap((contract) => {
      const rows: Record<string, unknown>[] = [];
      const isBlueprintReward = chainData.isBlueprintReward.get(contract.id) === true;
      const isBlueprintChain = (chainData.blueprintChainDepth.get(contract.id) ?? 0) > 0;
      const titleKey = normalizeLocalizationKey(contract.titleKey || '');
      const descKey = normalizeLocalizationKey(contract.descriptionLocKey || contract.descriptionKey || '');
      let titleTag = '';
      let descTag = '';
      if (isBlueprintReward) {
        titleTag = ` ${IniTag.EM4.wrap('[BP]')}`;
        descTag = '[BP Reward]';
      } else if (isBlueprintChain) {
        titleTag = ` ${IniTag.EM4.wrap('[BP Chain]')}`;
        descTag = '[BP Chain]';
      }
      const rewardList = isBlueprintReward ? buildBlueprintRewardList(contract, blueprintPools) : '';
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
