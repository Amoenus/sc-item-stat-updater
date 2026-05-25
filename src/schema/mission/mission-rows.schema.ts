import { z } from 'zod';

export const BlueprintPoolRowSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  source: z.string().optional(),
  blueprints: z.string(),
});
export type BlueprintPoolRowDTO = z.infer<typeof BlueprintPoolRowSchema>;

export const ContractBlueprintRowSchema = z.object({
  contractId: z.string(),
  debugName: z.string(),
  title: z.string(),
  blueprintPoolId: z.string(),
  poolName: z.string(),
  chance: z.number(),
  trigger: z.string(),
  blueprintSource: z.string().optional(),
  blueprintItems: z.string(),
});
export type ContractBlueprintRowDTO = z.infer<typeof ContractBlueprintRowSchema>;

export const MissionRowSchema = z.object({
  'Localization Key': z.string(),
  Description: z.string(),
  TitleNote: z.string(),
  Note: z.string(),
  RewardList: z.string(),
  ItemRewardList: z.string(),
  Cooldown: z.string(),
});
export type MissionRowDTO = z.infer<typeof MissionRowSchema>;

export const ContractRowSchema = z.object({
  id: z.string(),
  debugName: z.union([z.string(), z.null()]).optional(),
  category: z.union([z.string(), z.null()]).optional(),
  missionType: z.union([z.string(), z.null()]).optional(),
  missionTypeKey: z.union([z.string(), z.null()]).optional(),
  title: z.union([z.string(), z.null()]).optional(),
  titleKey: z.union([z.string(), z.null()]).optional(),
  description: z.union([z.string(), z.null()]).optional(),
  descriptionKey: z.union([z.string(), z.null()]).optional(),
  descriptionLocKey: z.union([z.string(), z.null()]).optional(),
  rewardUEC: z.union([z.number(), z.null()]).optional(),
  timeToComplete: z.union([z.number(), z.null()]).optional(),
  canBeShared: z.union([z.boolean(), z.null()]).optional(),
  illegal: z.union([z.boolean(), z.null()]).optional(),
  factionGuid: z.union([z.string(), z.null()]).optional(),
  locations: z.string().optional(),
  destinations: z.string().optional(),
  prerequisites: z.string().optional(),
  tokenSubstitutions: z.string().optional(),
  minStanding: z.string().optional(),
  maxStanding: z.string().optional(),
  blueprintRewards: z.string().optional(),
  isBlueprintReward: z.string(),
  isBlueprintChainPrerequisite: z.string(),
  blueprintChainDepth: z.string(),
  personalCooldownTime: z.number().optional(),
  rewardRepCalculated: z.number().optional(),
  factionRewards: z.string(),
  factionRewardsRaw: z.string(),
  shipEncounters: z.string().optional(),
  haulingOrders: z.string().optional(),
  itemRewards: z.string().optional(),
  completionTags: z.string().optional(),
  pyroRegion: z.string().optional(),
  buyIn: z.union([z.number(), z.string()]).optional(),
  onceOnly: z.boolean().optional(),
  maxPlayersPerInstance: z.number().optional(),
  availableInPrison: z.boolean().optional(),
  canReacceptAfterAbandoning: z.boolean().optional(),
  canReacceptAfterFailing: z.boolean().optional(),
  hasPersonalCooldown: z.boolean().optional(),
  abandonedCooldownTime: z.number().optional(),
  hideInMobiGlas: z.boolean().optional(),
  systems: z.string().optional(),
  factionRewards_fail: z.string().optional(),
  requiredScenarios: z.string().optional(),
  isIntro: z.union([z.boolean(), z.string()]).optional(),
  requiredIntros: z.string().optional(),
  linkedIntros: z.string().optional(),
  pickupCount: z.union([z.number(), z.string()]).optional(),
  deliveryCount: z.union([z.number(), z.string()]).optional(),
  propertyValues: z.string().optional(),
});
export type ContractRowDTO = z.infer<typeof ContractRowSchema>;
