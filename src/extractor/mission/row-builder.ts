import { IniTag } from '../../localization/ini-tags.js';
import {
  type ContractRowDTO,
  ContractRowSchema,
  type MissionRowDTO,
  MissionRowSchema,
} from '../../schema/mission/mission-rows.schema.js';
import type {
  ScmdbBlueprintPoolsDTO as BlueprintPoolsDTO,
  ScmdbContractDTO as ContractDTO,
  ScmdbLegacyContractDTO as LegacyContractDTO,
  ScmdbMergedDTO as MergedDTO,
} from '../../schema/scmdb.schemas.js';
import { buildBlueprintRowFields, type ChainDataDTO } from './blueprint-chain.js';
import {
  emptyValue,
  flattenValue,
  formatCooldownMinutes,
  formatRange,
  formatTimeLimit,
  formatUec,
  normalizeLocalizationKey,
  optionalValue,
} from './formatters.js';
import { buildBlueprintRewardList, buildItemRewardList, type FactionRewardsContext } from './rewards.js';

type ContractWithOptionalReputation = ContractDTO & {
  successReputationRewards?: string | null;
  failureReputationRewards?: string | null;
};

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
  successReputationRewards: string | null | undefined;
  failureReputationRewards: string | null | undefined;
  personalCooldownTime: number | null | undefined;
  rewardRepCalculated: number | null | undefined;
  factionRewardsIndex: number | null | undefined;
  shipEncounters: unknown;
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

export function toContractRowSource(contract: ContractDTO): ContractRowSource {
  const reputationContract = contract as ContractWithOptionalReputation;
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
    successReputationRewards: reputationContract.successReputationRewards,
    failureReputationRewards: reputationContract.failureReputationRewards,
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
    successReputationRewards: undefined,
    failureReputationRewards: undefined,
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
    successReputationRewards: contract.successReputationRewards ?? '',
    failureReputationRewards: contract.failureReputationRewards ?? '',
    ...buildFlattenedContractRowFields(contract),
    ...buildBlueprintRowFields(contract.id, chainData),
    ...buildDefaultedContractRowFields(contract),
    ...buildFactionRewardRowFields(contract.id, factionRewardsContext),
  });
}

export type MissionEnrichmentContext = Pick<MergedDTO, 'factions' | 'resourcePools'>;

function resolveFactionName(factionGuid: string, context?: MissionEnrichmentContext): string {
  return context?.factions?.[factionGuid]?.name ?? factionGuid;
}

function getContractCooldownText(contract: ContractDTO): string {
  if (!contract.hasPersonalCooldown || contract.personalCooldownTime <= 0) return '';
  return formatCooldownMinutes(contract.personalCooldownTime);
}

function buildContractIntel(contract: ContractDTO, context?: MissionEnrichmentContext): string {
  const lines: string[] = [];
  const timeLimit = contract.timeToComplete;
  const buyIn = contract.buyIn;
  const reputationContract = contract as ContractWithOptionalReputation;

  if (typeof timeLimit === 'number' && timeLimit > 0) {
    lines.push(`Time Limit: ${formatTimeLimit(timeLimit)}`);
  }
  const cooldown = getContractCooldownText(contract);
  if (cooldown) lines.push(`Cooldown: ${cooldown}`);
  if (typeof buyIn === 'number' && buyIn > 0) {
    lines.push(`Buy-in: ${formatUec(buyIn)}`);
  }
  if (contract.minStanding?.name) lines.push(`Requires: ${contract.minStanding.name}`);

  try {
    if (reputationContract.successReputationRewards) {
      const successRep = JSON.parse(reputationContract.successReputationRewards) as Array<{
        amount: number;
        factionGuid: string;
      }>;
      for (const reward of successRep) {
        lines.push(`Success: +${reward.amount} ${resolveFactionName(reward.factionGuid, context)}`);
      }
    }
    if (reputationContract.failureReputationRewards) {
      const failureRep = JSON.parse(reputationContract.failureReputationRewards) as Array<{
        amount: number;
        factionGuid: string;
      }>;
      for (const reward of failureRep) {
        lines.push(`Failure: ${reward.amount} ${resolveFactionName(reward.factionGuid, context)}`);
      }
    }
  } catch {}

  return lines.join(String.raw`\n`);
}

function sumWaveShips(waves: NonNullable<ContractDTO['shipEncounters']>['spawnConfig']['groups'][number]['waves']): {
  min: number;
  max: number;
} {
  return waves.reduce((sum, wave) => ({ min: sum.min + wave.minShips, max: sum.max + wave.maxShips }), {
    min: 0,
    max: 0,
  });
}

function buildEncounterSummary(contract: ContractDTO): string {
  const config = contract.shipEncounters?.spawnConfig;
  const groups = config?.groups ?? [];
  if (!config || groups.length === 0) return '';
  const lines: string[] = [`Encounter: ${formatRange(config.totalMinShips, config.totalMaxShips)} ships`];

  for (const group of groups) {
    const role = group.role.toLowerCase();
    const count = sumWaveShips(group.waves);
    if (count.max <= 0) continue;
    if (role.includes('target')) lines.push(`Target: ${formatRange(count.min, count.max)} ship(s)`);
    else if (role.includes('reinforc')) lines.push(`Reinforcements: ${formatRange(count.min, count.max)} ship(s)`);
    else if (role.includes('ally') || role.includes('friendly'))
      lines.push(`Allies: ${formatRange(count.min, count.max)} ship(s)`);
    else if (role.includes('salvage')) lines.push(`Salvage Target: ${formatRange(count.min, count.max)} ship(s)`);
    else if (group.classification === 'criminal') lines.push(`Hostiles: ${formatRange(count.min, count.max)} ship(s)`);
  }

  return [...new Set(lines)].slice(0, 5).join(String.raw`\n`);
}

function resolveResourceName(resourceId: string, context?: MissionEnrichmentContext): string {
  return context?.resourcePools?.[resourceId]?.name ?? resourceId;
}

function buildHaulingSummary(contract: ContractDTO, context?: MissionEnrichmentContext): string {
  const orders = contract.haulingOrders;
  if (!orders) return '';
  const formatOrder = (order: {
    resource: string;
    minSCU?: number;
    maxSCU?: number;
    maxContainerSize?: number;
  }): string => {
    const amount =
      order.minSCU !== undefined && order.maxSCU !== undefined
        ? `${formatRange(order.minSCU, order.maxSCU)} SCU`
        : order.minSCU !== undefined
          ? `${order.minSCU} SCU`
          : '';
    const container = order.maxContainerSize && order.maxContainerSize > 0 ? `, max ${order.maxContainerSize} SCU` : '';
    return `${amount ? `${amount} ` : ''}${resolveResourceName(order.resource, context)}${container}`;
  };

  if (Array.isArray(orders)) return `Order: ${orders.map(formatOrder).join(' + ')}`;
  if ('options' in orders)
    return `Order: ${orders.options.map((group) => group.map(formatOrder).join(' + ')).join(' OR ')}`;
  return '';
}

function buildTitleMissionRow(titleKey: string, title: string, titleTag: string): MissionRowDTO | null {
  if (!titleKey || !title) return null;
  return MissionRowSchema.parse({
    'Localization Key': titleKey,
    Description: title,
    TitleNote: titleTag,
    Note: '',
    ContractIntel: '',
    EncounterSummary: '',
    HaulingSummary: '',
    RewardList: '',
    ItemRewardList: '',
    Cooldown: '',
  });
}

function buildDescriptionMissionRow(
  descKey: string,
  description: string,
  descTag: string,
  contractIntel: string,
  encounterSummary: string,
  haulingSummary: string,
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
    ContractIntel: contractIntel,
    EncounterSummary: encounterSummary,
    HaulingSummary: haulingSummary,
    RewardList: rewardList,
    ItemRewardList: itemRewardList,
    Cooldown: cooldown,
  });
}

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

function isTrueIntroMission(contract: ContractDTO): boolean {
  return contract.isIntro === true;
}

function collectIntroTitleKeys(contracts: ContractDTO[]): ReadonlySet<string> {
  return new Set(
    contracts
      .filter(isTrueIntroMission)
      .map((contract) => normalizeLocalizationKey(contract.titleKey || ''))
      .filter(Boolean),
  );
}

function getMissionTitleTag(isIntroTitle: boolean, isBlueprintReward: boolean, isBlueprintChain: boolean): string {
  if (isIntroTitle) return ` ${IniTag.EM4.wrap('[Intro]')}`;
  return getBlueprintMissionTags(isBlueprintReward, isBlueprintChain).titleTag;
}

function buildMissionRowsForContract(
  contract: ContractDTO,
  chainData: ChainDataDTO,
  blueprintPools: BlueprintPoolsDTO,
  introTitleKeys: ReadonlySet<string>,
  context?: MissionEnrichmentContext,
): MissionRowDTO[] {
  const isBlueprintReward = chainData.isBlueprintReward.get(contract.id) === true;
  const isBlueprintChain = (chainData.blueprintChainDepth.get(contract.id) ?? 0) > 0;
  const tags = getBlueprintMissionTags(isBlueprintReward, isBlueprintChain);

  const titleKey = normalizeLocalizationKey(contract.titleKey || '');
  const titleTag = getMissionTitleTag(introTitleKeys.has(titleKey), isBlueprintReward, isBlueprintChain);
  const descKey = normalizeLocalizationKey(contract.descriptionLocKey || contract.descriptionKey || '');
  const rewardList = isBlueprintReward ? buildBlueprintRewardList(contract, blueprintPools) : '';
  const itemRewardList = buildItemRewardList(contract);
  const cooldown = getContractCooldownText(contract);
  const contractIntel = buildContractIntel(contract, context);
  const encounterSummary = buildEncounterSummary(contract);
  const haulingSummary = buildHaulingSummary(contract, context);

  const rows: MissionRowDTO[] = [];
  const titleRow = buildTitleMissionRow(titleKey, contract.title, titleTag);
  if (titleRow) rows.push(titleRow);
  const descRow = buildDescriptionMissionRow(
    descKey,
    contract.description,
    tags.descTag,
    contractIntel,
    encounterSummary,
    haulingSummary,
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
  context?: MissionEnrichmentContext,
): MissionRowDTO[] {
  const rowsByKey = new Map<string, MissionRowDTO>();
  const introTitleKeys = collectIntroTitleKeys(contracts);
  for (const row of contracts.flatMap((contract) =>
    buildMissionRowsForContract(contract, chainData, blueprintPools, introTitleKeys, context),
  )) {
    rowsByKey.set(row['Localization Key'], row);
  }
  return [...rowsByKey.values()];
}
