import { z } from 'zod';
import { ShipEncountersSchema } from './encounter.schema.js';
import {
  ArmorClassSchema,
  ArmorSlotSchema,
  CargoGradeTokenSchema,
  CargoRouteTokenSchema,
  CategorySchema,
  HaulingOrdersTypeSchema,
  ItemEnumSchema,
  ItemRewardTypeSchema,
  ItemTypeSchema,
  MissionMaxScuSizeSchema,
  MissionTypeKeySchema,
  MissionTypeSchema,
  MultiToSingleTokenSchema,
  PyroRegionSchema,
  ReputationRankSchema,
  RequiredScenarioNameSchema,
  SingleToMultiTokenSchema,
  SystemSchema,
  TitleKeySchema,
  TitleLocKeySchema,
  TriggerSchema,
} from './enums.schema.js';
import {
  LocationPropertySchema,
  LocationSetSchema,
  ResolvedLocationElementSchema,
  StarElementSchema,
  SubLocationVariantSchema,
  TagSearchLocationSchema,
} from './location.schema.js';
import { FactionRewardsSchema, MinStandingSchema, StandingSchema } from './reputation.schema.js';

// ---------------------------------------------------------------------------
// Contract, hauling, and reward schemas for the merged data domain.
// ---------------------------------------------------------------------------

export const EdIntroSchema = z.object({
  debugName: z.string(),
  title: z.string().optional(),
});
export type EdIntro = z.infer<typeof EdIntroSchema>;

export const RequiredScenarioSchema = z.object({
  name: RequiredScenarioNameSchema,
  enabled: z.boolean(),
});
export type RequiredScenario = z.infer<typeof RequiredScenarioSchema>;

export const CompletedContractTagsSchema = z.object({
  requiredCountValue: z.number().optional(),
  tags: z.array(z.string()).optional(),
  excludedTags: z.array(z.string()).optional(),
});
export type CompletedContractTags = z.infer<typeof CompletedContractTagsSchema>;

export const CrimeStatSchema = z.object({
  min: z.number(),
  max: z.number(),
  includeWhenSharing: z.boolean(),
});
export type CrimeStat = z.infer<typeof CrimeStatSchema>;

export const HaulingOrderSchema = z.object({
  minSCU: z.number().optional(),
  maxSCU: z.number().optional(),
  maxContainerSize: z.number().optional(),
  resource: z.string(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
});
export type HaulingOrder = z.infer<typeof HaulingOrderSchema>;

export const HaulingOrdersClassSchema = z.object({
  type: HaulingOrdersTypeSchema,
  options: z.array(z.array(HaulingOrderSchema)),
});
export type HaulingOrdersClass = z.infer<typeof HaulingOrdersClassSchema>;

export const TokenSubstitutionsSchema = z.object({
  CargoRouteToken: CargoRouteTokenSchema,
  CargoGradeToken: CargoGradeTokenSchema,
  ReputationRank: ReputationRankSchema,
  MissionMaxSCUSize: MissionMaxScuSizeSchema,
  Item: ItemEnumSchema.optional(),
  MultiToSingleToken: MultiToSingleTokenSchema.optional(),
  SingleToMultiToken: SingleToMultiTokenSchema.optional(),
});
export type TokenSubstitutions = z.infer<typeof TokenSubstitutionsSchema>;

export const PropertyLocationSchema = z.object({
  star: StarElementSchema.optional(),
});
export type PropertyLocation = z.infer<typeof PropertyLocationSchema>;

export const BlueprintRewardSchema = z.object({
  blueprintPool: z.string(),
  chance: z.number(),
  poolName: z.string(),
  trigger: TriggerSchema,
});
export type BlueprintReward = z.infer<typeof BlueprintRewardSchema>;

export const CompletionTagSchema = z.object({
  count: z.number(),
  tag: z.string(),
  splitPointsForParty: z.boolean(),
});
export type CompletionTag = z.infer<typeof CompletionTagSchema>;

export const ItemSchema = z.object({
  name: z.string(),
  amount: z.number(),
  itemType: ItemTypeSchema.optional(),
  armorSlot: ArmorSlotSchema.optional(),
  armorClass: ArmorClassSchema.optional(),
});
export type Item = z.infer<typeof ItemSchema>;

export const ItemRewardGroupSchema = z.object({
  weighting: z.number(),
  probability: z.number(),
  items: z.array(ItemSchema),
});
export type ItemRewardGroup = z.infer<typeof ItemRewardGroupSchema>;

export const ItemRewardSchema = z.object({
  entityClass: z.string().optional(),
  name: z.union([z.null(), z.string()]).optional(),
  amount: z.number().optional(),
  type: ItemRewardTypeSchema.optional(),
  groups: z.array(ItemRewardGroupSchema).optional(),
  itemType: ItemTypeSchema.optional(),
});
export type ItemReward = z.infer<typeof ItemRewardSchema>;

export const ContractPrerequisitesSchema = z.object({
  location: z.array(ResolvedLocationElementSchema).optional(),
  locality: z.array(z.object({ name: z.string() })).optional(),
  completedContractTags: CompletedContractTagsSchema.optional(),
  propertyLocations: z.array(PropertyLocationSchema).optional(),
  crimeStat: CrimeStatSchema.optional(),
  tagSearchLocations: z.array(TagSearchLocationSchema).optional(),
  locationProperty: LocationPropertySchema.optional(),
  subLocationVariants: z.array(z.array(SubLocationVariantSchema)).optional(),
});
export type ContractPrerequisites = z.infer<typeof ContractPrerequisitesSchema>;

export const LegacyContractHaulingOrderSchema = z.object({
  resource: z.union([z.string(), z.null()]),
  minSCU: z.number(),
  maxSCU: z.number(),
  maxContainerSize: z.number(),
});
export type LegacyContractHaulingOrder = z.infer<typeof LegacyContractHaulingOrderSchema>;

export const LegacyContractPrerequisitesSchema = z.object({
  location: z.union([z.array(SubLocationVariantSchema), z.null()]),
});
export type LegacyContractPrerequisites = z.infer<typeof LegacyContractPrerequisitesSchema>;

export const LegacyContractSchema = z.object({
  id: z.string(),
  debugName: z.string(),
  titleKey: TitleKeySchema,
  titleLocKey: TitleLocKeySchema,
  title: z.string(),
  descriptionKey: z.string(),
  descriptionLocKey: z.string(),
  description: z.string(),
  tokenSubstitutions: TokenSubstitutionsSchema,
  factionGuid: z.string(),
  missionType: MissionTypeSchema,
  rewardUEC: z.number(),
  rewardIsDynamic: z.boolean(),
  haulingOrders: z.array(LegacyContractHaulingOrderSchema),
  pickupCount: z.number(),
  deliveryCount: z.number(),
  minStanding: StandingSchema,
  canBeShared: z.boolean(),
  illegal: z.boolean(),
  onceOnly: z.boolean(),
  maxPlayersPerInstance: z.number(),
  personalCooldownTime: z.number(),
  canReacceptAfterAbandoning: z.boolean(),
  canReacceptAfterFailing: z.boolean(),
  locations: z.union([z.array(z.string()), z.null()]),
  destinations: z.union([z.array(z.string()), z.null()]),
  prerequisites: LegacyContractPrerequisitesSchema,
  systems: z.array(SystemSchema).optional(),
  partialRewardPayoutIndex: z.number(),
  availabilityIndex: z.number(),
  factionRewardsIndex: z.number(),
  locationSets: z.array(LocationSetSchema).optional(),
  debugNames: z.array(z.string()).optional(),
  descriptionKeys: z.array(z.string()).optional(),
});
export type LegacyContract = z.infer<typeof LegacyContractSchema>;

export const ContractSchema = z.object({
  id: z.string(),
  debugName: z.string(),
  category: CategorySchema,
  missionType: z.union([MissionTypeSchema, z.null()]),
  missionTypeKey: z.union([MissionTypeKeySchema, z.null()]),
  title: z.string(),
  description: z.string(),
  factionGuid: z.union([z.null(), z.string()]),
  canBeShared: z.union([z.boolean(), z.null()]),
  illegal: z.union([z.boolean(), z.null()]),
  timeToComplete: z.number(),
  locations: z.union([z.array(z.string()), z.null()]),
  destinations: z.union([z.array(z.string()), z.null()]),
  locationSets: z.union([z.array(LocationSetSchema), z.null()]),
  prerequisites: ContractPrerequisitesSchema,
  pyroRegion: z.union([z.array(PyroRegionSchema), z.null()]),
  rewardUEC: z.union([z.number(), z.null()]),
  rewardRepCalculated: z.union([z.number(), z.null()]).optional(),
  buyIn: z.union([z.number(), z.null()]),
  minStanding: z.union([MinStandingSchema, z.null()]),
  maxStanding: z.union([StandingSchema, z.null()]),
  shipEncounters: z.union([ShipEncountersSchema, z.null()]),
  propertyValues: z.union([z.record(z.string(), z.number()), z.null()]),
  titleKey: z.string(),
  descriptionKey: z.string(),
  haulingOrders: z.union([z.array(HaulingOrderSchema), HaulingOrdersClassSchema, z.null()]),
  tokenSubstitutions: z.record(z.string(), z.string()).optional(),
  descriptionLocKey: z.string(),
  titleLocKey: z.string(),
  debugNames: z.array(z.string()).optional(),
  onceOnly: z.boolean(),
  maxPlayersPerInstance: z.number(),
  availableInPrison: z.boolean(),
  canReacceptAfterAbandoning: z.boolean(),
  canReacceptAfterFailing: z.boolean(),
  hasPersonalCooldown: z.boolean(),
  personalCooldownTime: z.number(),
  abandonedCooldownTime: z.number(),
  hideInMobiGlas: z.boolean(),
  systems: z.array(SystemSchema).optional(),
  partialRewardPayoutIndex: z.number(),
  availabilityIndex: z.number(),
  factionRewardsIndex: z.number().optional(),
  blueprintRewards: z.array(BlueprintRewardSchema).optional(),
  requiredIntros: z.array(EdIntroSchema).optional(),
  completionTags: z.array(CompletionTagSchema).optional(),
  linkedIntros: z.array(EdIntroSchema).optional(),
  isIntro: z.boolean().optional(),
  factionRewards_fail: z.array(FactionRewardsSchema).optional(),
  requiredScenarios: z.array(RequiredScenarioSchema).optional(),
  itemRewards: z.array(ItemRewardSchema).optional(),
  pickupCount: z.number().optional(),
  deliveryCount: z.number().optional(),
});
export type Contract = z.infer<typeof ContractSchema>;
