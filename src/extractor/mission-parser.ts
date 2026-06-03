import { IniTag } from '../lib/ini-tags';
import {
  type BlueprintPoolRowDTO,
  BlueprintPoolRowSchema,
  type ContractBlueprintRowDTO,
  ContractBlueprintRowSchema,
  type ContractRowDTO,
  ContractRowSchema,
  type MissionRowDTO,
  MissionRowSchema,
} from '../schema/mission/mission-rows.schema.js';
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
  // Extended fields
  haulingOrders: unknown;
  itemRewards: unknown;
  completionTags: unknown;
  pyroRegion: unknown;
  buyIn: number | null | undefined;
  onceOnly: boolean | null | undefined;
  maxPlayersPerInstance: number | null | undefined;
  availableInPrison: boolean | null | undefined;
  canReacceptAfterAbandoning: boolean | null | undefined;
  canReacceptAfterFailing: boolean | null | undefined;
  hasPersonalCooldown: boolean | null | undefined;
  abandonedCooldownTime: number | null | undefined;
  hideInMobiGlas: boolean | null | undefined;
  systems: unknown;
  factionRewards_fail: unknown;
  requiredScenarios: unknown;
  isIntro: boolean | null | undefined;
  requiredIntros: unknown;
  linkedIntros: unknown;
  pickupCount: number | null | undefined;
  deliveryCount: number | null | undefined;
  propertyValues: unknown;
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
    haulingOrders: contract.haulingOrders,
    itemRewards: contract.itemRewards,
    completionTags: contract.completionTags,
    pyroRegion: contract.pyroRegion,
    buyIn: contract.buyIn,
    onceOnly: contract.onceOnly,
    maxPlayersPerInstance: contract.maxPlayersPerInstance,
    availableInPrison: contract.availableInPrison,
    canReacceptAfterAbandoning: contract.canReacceptAfterAbandoning,
    canReacceptAfterFailing: contract.canReacceptAfterFailing,
    hasPersonalCooldown: contract.hasPersonalCooldown,
    abandonedCooldownTime: contract.abandonedCooldownTime,
    hideInMobiGlas: contract.hideInMobiGlas,
    systems: contract.systems,
    factionRewards_fail: contract.factionRewards_fail,
    requiredScenarios: contract.requiredScenarios,
    isIntro: contract.isIntro,
    requiredIntros: contract.requiredIntros,
    linkedIntros: contract.linkedIntros,
    pickupCount: contract.pickupCount,
    deliveryCount: contract.deliveryCount,
    propertyValues: contract.propertyValues,
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
    haulingOrders: contract.haulingOrders,
    itemRewards: undefined,
    completionTags: undefined,
    pyroRegion: undefined,
    buyIn: undefined,
    onceOnly: contract.onceOnly,
    maxPlayersPerInstance: contract.maxPlayersPerInstance,
    availableInPrison: undefined,
    canReacceptAfterAbandoning: contract.canReacceptAfterAbandoning,
    canReacceptAfterFailing: contract.canReacceptAfterFailing,
    hasPersonalCooldown: undefined,
    abandonedCooldownTime: undefined,
    hideInMobiGlas: undefined,
    systems: contract.systems,
    factionRewards_fail: undefined,
    requiredScenarios: undefined,
    isIntro: undefined,
    requiredIntros: undefined,
    linkedIntros: undefined,
    pickupCount: contract.pickupCount,
    deliveryCount: contract.deliveryCount,
    propertyValues: undefined,
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
function flattenValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function optionalValue<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

function emptyValue<T>(value: T | null | undefined): T | '' {
  return value ?? '';
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

function buildFactionRewardsString(pool: FactionRewardsDTO[], factionNames: Map<string, string>): string {
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

function buildBlueprintRowFields(contractId: string, chainData: ChainDataDTO): Pick<
  ContractRowDTO,
  'isBlueprintReward' | 'isBlueprintChainPrerequisite' | 'blueprintChainDepth'
> {
  const isBlueprintReward = chainData.isBlueprintReward.get(contractId) === true;
  const depth = chainData.blueprintChainDepth.get(contractId);
  return {
    isBlueprintReward: isBlueprintReward ? 'true' : 'false',
    isBlueprintChainPrerequisite: depth !== undefined && depth > 0 ? 'true' : 'false',
    blueprintChainDepth: depth === undefined ? '' : String(depth),
  };
}

function buildFlattenedContractRowFields(
  contract: ContractRowSource,
): Pick<
  ContractRowDTO,
  | 'locations'
  | 'destinations'
  | 'prerequisites'
  | 'tokenSubstitutions'
  | 'minStanding'
  | 'maxStanding'
  | 'blueprintRewards'
  | 'shipEncounters'
  | 'haulingOrders'
  | 'itemRewards'
  | 'completionTags'
  | 'pyroRegion'
  | 'systems'
  | 'factionRewards_fail'
  | 'requiredScenarios'
  | 'requiredIntros'
  | 'linkedIntros'
  | 'propertyValues'
> {
  return {
    locations: flattenValue(contract.locations),
    destinations: flattenValue(contract.destinations),
    prerequisites: flattenValue(contract.prerequisites),
    tokenSubstitutions: flattenValue(contract.tokenSubstitutions),
    minStanding: flattenValue(contract.minStanding),
    maxStanding: flattenValue(contract.maxStanding),
    blueprintRewards: flattenValue(contract.blueprintRewards),
    shipEncounters: flattenValue(contract.shipEncounters),
    haulingOrders: flattenValue(contract.haulingOrders),
    itemRewards: flattenValue(contract.itemRewards),
    completionTags: flattenValue(contract.completionTags),
    pyroRegion: flattenValue(contract.pyroRegion),
    systems: flattenValue(contract.systems),
    factionRewards_fail: flattenValue(contract.factionRewards_fail),
    requiredScenarios: flattenValue(contract.requiredScenarios),
    requiredIntros: flattenValue(contract.requiredIntros),
    linkedIntros: flattenValue(contract.linkedIntros),
    propertyValues: flattenValue(contract.propertyValues),
  };
}

function buildDefaultedContractRowFields(
  contract: ContractRowSource,
): Pick<
  ContractRowDTO,
  | 'personalCooldownTime'
  | 'rewardRepCalculated'
  | 'buyIn'
  | 'onceOnly'
  | 'maxPlayersPerInstance'
  | 'availableInPrison'
  | 'canReacceptAfterAbandoning'
  | 'canReacceptAfterFailing'
  | 'hasPersonalCooldown'
  | 'abandonedCooldownTime'
  | 'hideInMobiGlas'
  | 'isIntro'
  | 'pickupCount'
  | 'deliveryCount'
> {
  return {
    personalCooldownTime: optionalValue(contract.personalCooldownTime),
    rewardRepCalculated: optionalValue(contract.rewardRepCalculated),
    buyIn: emptyValue(contract.buyIn),
    onceOnly: optionalValue(contract.onceOnly),
    maxPlayersPerInstance: optionalValue(contract.maxPlayersPerInstance),
    availableInPrison: optionalValue(contract.availableInPrison),
    canReacceptAfterAbandoning: optionalValue(contract.canReacceptAfterAbandoning),
    canReacceptAfterFailing: optionalValue(contract.canReacceptAfterFailing),
    hasPersonalCooldown: optionalValue(contract.hasPersonalCooldown),
    abandonedCooldownTime: optionalValue(contract.abandonedCooldownTime),
    hideInMobiGlas: optionalValue(contract.hideInMobiGlas),
    isIntro: emptyValue(contract.isIntro),
    pickupCount: emptyValue(contract.pickupCount),
    deliveryCount: emptyValue(contract.deliveryCount),
  };
}

function buildFactionRewardRowFields(
  contractId: string,
  context: FactionRewardsContext,
): Pick<ContractRowDTO, 'factionRewards' | 'factionRewardsRaw'> {
  return {
    factionRewards: context.factionRewards.get(contractId) ?? '',
    factionRewardsRaw: context.factionRewardsRaw.get(contractId) ?? '',
  };
}

/**
 * Builds a contract row.
 */
export function buildContractRow(
  contract: ContractRowSource,
  chainData: ChainDataDTO,
  factionRewardsContext: FactionRewardsContext,
): ContractRowDTO {
  return ContractRowSchema.parse({
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
    ...buildFlattenedContractRowFields(contract),
    ...buildBlueprintRowFields(contract.id, chainData),
    ...buildDefaultedContractRowFields(contract),
    ...buildFactionRewardRowFields(contract.id, factionRewardsContext),
  });
}

function formatDirectRewardLine(reward: NonNullable<ContractDTO['itemRewards']>[number]): string {
  const qty = reward.amount && reward.amount > 1 ? ` x${reward.amount}` : '';
  return `- ${reward.name}${qty}`;
}

function formatGroupRewardLines(reward: NonNullable<ContractDTO['itemRewards']>[number]): string[] {
  const lines: string[] = [];
  for (const group of reward.groups ?? []) {
    if (Number.isFinite(group.probability) && group.probability < 1) {
      lines.push(`${Math.round(group.probability * 100)}% chance \u2014 1 of ${group.items.length}:`);
    }
    for (const item of group.items) {
      const qty = item.amount > 1 ? ` x${item.amount}` : '';
      lines.push(`- ${item.name}${qty}`);
    }
  }
  return lines;
}

/**
 * Builds a formatted item reward list string for use in mission descriptions.
 */
function buildItemRewardList(contract: ContractDTO): string {
  if (!contract.itemRewards?.length) return '';
  const lines: string[] = [];
  for (const reward of contract.itemRewards) {
    if (reward.name) {
      lines.push(formatDirectRewardLine(reward));
    } else {
      lines.push(...formatGroupRewardLines(reward));
    }
  }
  return lines.join(String.raw`\n`);
}

/**
 * Builds blueprint pool rows.
 */
export function buildBlueprintPoolRows(blueprintPools: BlueprintPoolsDTO): BlueprintPoolRowDTO[] {
  return Object.entries(blueprintPools).map(([id, pool]) =>
    BlueprintPoolRowSchema.parse({
      id,
      name: pool.name,
      source: pool.source,
      blueprints: flattenValue(pool.blueprints),
    }),
  );
}

/**
 * Builds contract blueprint rows.
 */
export function buildContractBlueprintRows(
  contracts: ContractDTO[],
  blueprintPools: BlueprintPoolsDTO,
): ContractBlueprintRowDTO[] {
  return contracts.flatMap((contract) => {
    if (!contract.blueprintRewards) return [];
    return contract.blueprintRewards.map((entry) =>
      ContractBlueprintRowSchema.parse({
        contractId: contract.id,
        debugName: contract.debugName,
        title: contract.title,
        blueprintPoolId: entry.blueprintPool,
        poolName: entry.poolName,
        chance: entry.chance,
        trigger: entry.trigger,
        blueprintSource: blueprintPools[entry.blueprintPool]?.source,
        blueprintItems: flattenValue(blueprintPools[entry.blueprintPool]?.blueprints),
      }),
    );
  });
}

/**
 * Builds a blueprint reward list.
 */
function buildBlueprintRewardList(contract: ContractDTO, blueprintPools: BlueprintPoolsDTO): string {
  if (!contract.blueprintRewards) return '';

  const formatChance = (chance: number): string | null => {
    if (!Number.isFinite(chance)) return null;
    return `${Math.round(chance * 100)}% chance`;
  };

  const sections = [];
  for (const entry of contract.blueprintRewards) {
    const pool = blueprintPools[entry.blueprintPool];
    if (!pool) continue;

    const itemNames = pool.blueprints.map((blueprint) => blueprint.name ?? null).filter((n): n is string => Boolean(n));

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
 * Formats a cooldown duration (in minutes) as a human-readable string.
 */
function formatCooldownMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Normalizes a localization key.
 */
function normalizeLocalizationKey(key: string): string {
  if (!key || typeof key !== 'string') return '';
  return key.startsWith('@') ? key.slice(1) : key;
}

/**
 * INI tags appended to mission title/description rows when a contract is part
 * of a blueprint reward chain. `titleTag` is wrapped in `IniTag.EM4`; `descTag`
 * is plain text appended by the description rebuilder.
 */
interface MissionBlueprintTags {
  titleTag: string;
  descTag: string;
}

const NO_BLUEPRINT_TAGS: MissionBlueprintTags = { titleTag: '', descTag: '' };

function getBlueprintMissionTags(isBlueprintReward: boolean, isBlueprintChain: boolean): MissionBlueprintTags {
  if (isBlueprintReward) {
    return { titleTag: ` ${IniTag.EM4.wrap('[BP]')}`, descTag: '[BP Reward]' };
  }
  if (isBlueprintChain) {
    return { titleTag: ` ${IniTag.EM4.wrap('[BP Chain]')}`, descTag: '[BP Chain]' };
  }
  return NO_BLUEPRINT_TAGS;
}

function getContractCooldownText(contract: ContractDTO): string {
  if (!contract.hasPersonalCooldown || contract.personalCooldownTime <= 0) return '';
  return formatCooldownMinutes(contract.personalCooldownTime);
}

function buildTitleMissionRow(titleKey: string, title: string, titleTag: string): MissionRowDTO | null {
  if (!titleKey || !title) return null;
  return MissionRowSchema.parse({
    'Localization Key': titleKey,
    Description: title,
    TitleNote: titleTag,
    Note: '',
    RewardList: '',
    ItemRewardList: '',
    Cooldown: '',
  });
}

function buildDescriptionMissionRow(
  descKey: string,
  description: string,
  descTag: string,
  rewardList: string,
  itemRewardList: string,
  cooldown: string,
): MissionRowDTO | null {
  if (!descKey || !description) return null;
  return MissionRowSchema.parse({
    'Localization Key': descKey,
    Description: description,
    Note: descTag,
    TitleNote: '',
    RewardList: rewardList,
    ItemRewardList: itemRewardList,
    Cooldown: cooldown,
  });
}

function buildMissionRowsForContract(
  contract: ContractDTO,
  chainData: ChainDataDTO,
  blueprintPools: BlueprintPoolsDTO,
): MissionRowDTO[] {
  const isBlueprintReward = chainData.isBlueprintReward.get(contract.id) === true;
  const isBlueprintChain = (chainData.blueprintChainDepth.get(contract.id) ?? 0) > 0;
  const tags = getBlueprintMissionTags(isBlueprintReward, isBlueprintChain);

  const titleKey = normalizeLocalizationKey(contract.titleKey || '');
  const descKey = normalizeLocalizationKey(contract.descriptionLocKey || contract.descriptionKey || '');
  const rewardList = isBlueprintReward ? buildBlueprintRewardList(contract, blueprintPools) : '';
  const itemRewardList = buildItemRewardList(contract);
  const cooldown = getContractCooldownText(contract);

  const rows: MissionRowDTO[] = [];
  const titleRow = buildTitleMissionRow(titleKey, contract.title, tags.titleTag);
  if (titleRow) rows.push(titleRow);
  const descRow = buildDescriptionMissionRow(
    descKey,
    contract.description,
    tags.descTag,
    rewardList,
    itemRewardList,
    cooldown,
  );
  if (descRow) rows.push(descRow);
  return rows;
}

/**
 * Builds mission rows.
 */
export function buildMissionRows(
  contracts: ContractDTO[],
  chainData: ChainDataDTO,
  blueprintPools: BlueprintPoolsDTO,
): MissionRowDTO[] {
  return contracts.flatMap((contract) => buildMissionRowsForContract(contract, chainData, blueprintPools));
}
