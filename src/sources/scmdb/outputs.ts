import type { ScmdbMemaCacheDTO, ScmdbMergedDTO, ScmdbMiningDataDTO } from '../../schema/scmdb.schemas';
import { buildMemaRows } from './mema-parser';
import { buildMiningElementRows, buildMiningJournalRows } from './mining-parser';
import {
  buildContractRow,
  buildFactionRewardsContext,
  buildMissionRows,
  collectBlueprintChainData,
  toContractRowSource,
  toLegacyContractRowSource,
} from './mission-parser';

export const SCMDB_MISSION_HEADERS = [
  'Localization Key',
  'Description',
  'TitleNote',
  'Note',
  'ContractIntel',
  'EncounterSummary',
  'HaulingSummary',
  'RewardList',
  'ItemRewardList',
  'Cooldown',
];

export const SCMDB_CONTRACT_HEADERS = [
  'id',
  'debugName',
  'category',
  'missionType',
  'missionTypeKey',
  'title',
  'titleKey',
  'description',
  'descriptionKey',
  'descriptionLocKey',
  'rewardUEC',
  'timeToComplete',
  'canBeShared',
  'illegal',
  'factionGuid',
  'locations',
  'destinations',
  'prerequisites',
  'tokenSubstitutions',
  'minStanding',
  'maxStanding',
  'blueprintRewards',
  'isBlueprintReward',
  'isBlueprintChainPrerequisite',
  'blueprintChainDepth',
  'personalCooldownTime',
  'rewardRepCalculated',
  'factionRewards',
  'factionRewardsRaw',
  'shipEncounters',
  'haulingOrders',
  'itemRewards',
  'completionTags',
  'pyroRegion',
  'buyIn',
  'onceOnly',
  'maxPlayersPerInstance',
  'availableInPrison',
  'canReacceptAfterAbandoning',
  'canReacceptAfterFailing',
  'hasPersonalCooldown',
  'abandonedCooldownTime',
  'hideInMobiGlas',
  'systems',
  'factionRewards_fail',
  'requiredScenarios',
  'isIntro',
  'requiredIntros',
  'linkedIntros',
  'pickupCount',
  'deliveryCount',
  'propertyValues',
];


export const SCMDB_MINING_ELEMENT_HEADERS = [
  'Element Name',
  'Rarity',
  'Ground Scan Signature',
  'FPS Scan Signature',
  'Scan Signature',
  'Resistance',
  'Instability',
  'Density',
  'Optimal Window Midpoint',
  'Optimal Window Randomness',
  'Optimal Window Thinness',
  'Explosion Multiplier',
  'Cluster Factor',
  'Quality Bands',
  'Material Name',
  'Mining Difficulty',
  'Volatility Note',
  'Cluster Note',
  'Best Refinery',
];

export const SCMDB_MINING_JOURNAL_HEADERS = ['Rarity Category', 'Element List', 'Insight Summary'];

export const SCMDB_MEMA_HEADERS = [
  'description_key',
  'mema_uec',
  'rate_p50',
  'dur_avg',
  'avg_diff',
  'avg_sat',
  'runs',
];


export interface ScmdbOutputRows {
  missionRows: ReturnType<typeof buildMissionRows>;
  contractRows: ReturnType<typeof buildContractRow>[];
  legacyRows: ReturnType<typeof buildContractRow>[];
  miningElementRows: ReturnType<typeof buildMiningElementRows>;
  miningJournalRows: ReturnType<typeof buildMiningJournalRows>;
  memaRows: ReturnType<typeof buildMemaRows>;
}

export function buildScmdbOutputRows(
  mergedData: ScmdbMergedDTO,
  miningData: ScmdbMiningDataDTO | null,
  memaData: ScmdbMemaCacheDTO | null,
): ScmdbOutputRows {
  const chainData = collectBlueprintChainData(mergedData.contracts);
  const factionRewardsContext = buildFactionRewardsContext(
    mergedData.factionRewardsPools,
    mergedData.factions,
    mergedData.contracts,
  );

  return {
    missionRows: buildMissionRows(mergedData.contracts, chainData, mergedData.blueprintPools, mergedData),
    contractRows: mergedData.contracts.map((contract) =>
      buildContractRow(toContractRowSource(contract), chainData, factionRewardsContext),
    ),
    legacyRows: mergedData.legacyContracts.map((contract) =>
      buildContractRow(toLegacyContractRowSource(contract), chainData, factionRewardsContext),
    ),
    miningElementRows: miningData ? buildMiningElementRows(miningData) : [],
    miningJournalRows: miningData ? buildMiningJournalRows(miningData) : [],
    memaRows: memaData ? buildMemaRows(memaData, mergedData) : [],
  };
}
