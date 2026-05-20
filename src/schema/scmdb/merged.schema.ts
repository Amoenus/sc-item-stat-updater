// @ts-check
import { z } from 'zod';

// ---------------------------------------------------------------------------
// merged-*.json
// ---------------------------------------------------------------------------

export const SourceSchema = z.enum([
  'blueprintmissionpools',
  'collectorwikelo',
  '48blueprints',
  'xenothreat2rewards',
]);
export type Source = z.infer<typeof SourceSchema>;

export const FillTypeSchema = z.enum(['even', 'random']);
export type FillType = z.infer<typeof FillTypeSchema>;

export const TriggerSchema = z.enum(['accept', 'complete']);
export type Trigger = z.infer<typeof TriggerSchema>;

export const CategorySchema = z.enum(['career', 'event', 'story']);
export type Category = z.infer<typeof CategorySchema>;

export const HaulingOrdersTypeSchema = z.enum(['or']);
export type HaulingOrdersType = z.infer<typeof HaulingOrdersTypeSchema>;

export const ArmorClassSchema = z.enum(['heavy', 'helmet', 'light', 'medium']);
export type ArmorClass = z.infer<typeof ArmorClassSchema>;

export const ArmorSlotSchema = z.enum([
  'arms',
  'backpack',
  'chest',
  'helmet',
  'legs',
  'undersuit',
]);
export type ArmorSlot = z.infer<typeof ArmorSlotSchema>;

export const ItemTypeSchema = z.enum([
  'armor',
  'clothing',
  'vehicle',
  'weapon',
  'weapon_attachment',
]);
export type ItemType = z.infer<typeof ItemTypeSchema>;

export const ItemRewardTypeSchema = z.enum(['weighted_choice']);
export type ItemRewardType = z.infer<typeof ItemRewardTypeSchema>;

export const MinStandingNameSchema = z.enum([
  'Applicant',
  'Assassin In Training',
  'Contractor',
  'Elite Contractor',
  'Experienced',
  'Guild Steward',
  'Head Contractor',
  'Jr. Contractor',
  'Junior',
  'Master',
  'Master Assassin',
  'Master Tracker',
  'Member',
  'Neutral',
  'Rookie',
  'Senior',
  'Sr. Contractor',
  'Trainee',
  'Under Review',
  'Veteran Contractor',
]);
export type MinStandingName = z.infer<typeof MinStandingNameSchema>;

export const NameKeySchema = z.enum([
  'mobiGlas_Reputation_Stance_Neutral',
  'RepScope_Contractor_Rank0',
  'RepScope_Contractor_Rank1',
  'RepScope_Contractor_Rank2',
  'RepScope_Contractor_Rank3',
  'RepScope_Contractor_Rank4',
  'RepScope_Contractor_Rank5',
  'RepScope_Contractor_Rank6',
  'RepStanding_Assassination_Rank0',
  'RepStanding_Assassination_Rank1',
  'RepStanding_Assassination_Rank6',
  'RepStanding_Bounty_Applicant_Name',
  'RepStanding_Bounty_LegendaryBountyHunter_Name',
  'RepStanding_Bounty_Rank6',
  'RepStanding_Security_Rank0',
  'RepStanding_TransportGuild_Rank0',
  'RepStanding_TransportGuild_Rank1',
  'RepStanding_TransportGuild_Rank2',
  'RepStanding_TransportGuild_Rank3',
  'RepStanding_TransportGuild_Rank4',
  'RepStanding_TransportGuild_Rank5',
  'RepStanding_TransportGuild_Rank6',
]);
export type NameKey = z.infer<typeof NameKeySchema>;

export const ScopeNameSchema = z.enum([
  'Affinity',
  'Assassination',
  'BountyHunter',
  'BountyHunter_BountyHuntersGuild',
  'FactionReputation',
  'Hauling',
  'Security',
  'ShipCombat_HeadHunters',
  'Wikelo',
]);
export type ScopeName = z.infer<typeof ScopeNameSchema>;

export const MissionTypeSchema = z.enum([
  'Bounty Hunter',
  'Collection',
  'Courier',
  'Delivery',
  'Ground Vehicle Mining',
  'Hand Mining',
  'Hauling',
  'Hauling - Interstellar',
  'Hauling - Local',
  'Hauling - Planetary',
  'Hauling - Stellar',
  'Investigation',
  'local',
  'Maintenance',
  'Mercenary',
  'Priority',
  'PvP Missions',
  'Refueling',
  'Salvage',
  'Ship Mining',
  'Wikelo - Other Items',
  'Wikelo - Vehicles',
]);
export type MissionType = z.infer<typeof MissionTypeSchema>;

export const MissionTypeKeySchema = z.enum([
  '@chat_command_local',
  '@ContractManager_TempTab_Small_Items',
  '@ContractManager_TempTab_Vehicles',
  '@mobiGlas_ui_MissionType_Collection',
  '@mobiGlas_ui_MissionType_Courier',
  '@mobiGlas_ui_MissionType_Delivery',
  '@mobiGlas_ui_MissionType_Hauling',
  '@mobiGlas_ui_MissionType_Hauling_Interstellar',
  '@mobiGlas_ui_MissionType_Hauling_Local',
  '@mobiGlas_ui_MissionType_Hauling_Planetary',
  '@mobiGlas_ui_MissionType_Hauling_Solar',
  '@mobiglas_ui_BountyHunter',
  '@mobiglas_ui_FPSMining',
  '@mobiglas_ui_GroundMining',
  '@mobiglas_ui_Investigation',
  '@mobiglas_ui_Maintenance',
  '@mobiglas_ui_Mercenary',
  '@mobiglas_ui_Priority',
  '@mobiglas_ui_PVPMissions',
  '@mobiglas_ui_Salvage',
  '@mobiglas_ui_ShipMining',
  '@refueling_ui_Login_Refuel',
]);
export type MissionTypeKey = z.infer<typeof MissionTypeKeySchema>;

export const NavIconEnumSchema = z.enum([
  'Default',
  'Destination',
  'LandingZone',
  'Moon',
  'Outpost',
  'Planet',
  'Star',
  'Station',
]);
export type NavIconEnum = z.infer<typeof NavIconEnumSchema>;

export const PlanetEnumSchema = z.enum([
  'Aberdeen',
  'ArcCorp',
  'Calliope',
  'Cellin',
  'Clio',
  'Crusader',
  'Daymar',
  'Euterpe',
  'Hurston',
  'Ita',
  'Lyria',
  'Magda',
  'microTech',
  "People's Service Station Alpha",
  "People's Service Station Delta",
  "People's Service Station Lambda",
  "People's Service Station Theta",
  'Stanton',
  'Wala',
  'Yela',
]);
export type PlanetEnum = z.infer<typeof PlanetEnumSchema>;

export const PyroRegionSchema = z.enum(['A', 'B', 'C', 'D']);
export type PyroRegion = z.infer<typeof PyroRegionSchema>;

export const RequiredScenarioNameSchema = z.enum([
  'CleanAir_Scenario',
  'ContentBlocker_Scenario',
  'Luminalia Holiday Event',
  'RoX_Scenario',
]);
export type RequiredScenarioName = z.infer<typeof RequiredScenarioNameSchema>;

export const CargoManifestElementSchema = z.enum([
  'criminal/illegalcargo_highvalue_halfcargo',
  'criminal/illegalcargo_lowvalue_halfcargo',
  'criminal/illegalcargo_lowvalue_minimalcargo',
  'criminal/illegalcargo_lowvalue_scraps',
  'criminal/illegalcargo_mediumvalue_fullcargo',
  'criminal/illegalcargo_mediumvalue_halfcargo',
  'legalcargo_cleanair_cryopod',
  'legalcargo_cleanair_large',
  'legalcargo_cleanair_medium',
  'legalcargo_cleanair_small',
  'legalcargo_generic_highvalue_fullcargo',
  'legalcargo_generic_highvalue_minimalcargo',
  'legalcargo_generic_lowvalue_fullcargo',
  'legalcargo_generic_lowvalue_halfcargo',
  'legalcargo_generic_lowvalue_minimalcargo',
  'legalcargo_generic_lowvalue_scraps',
  'legalcargo_generic_mediumvalue_fullcargo',
  'legalcargo_generic_mediumvalue_halfcargo',
  'legalcargo_generic_mediumvalue_minimalcargo',
  'legalcargo_tsg',
  'mixedcargo_generic_highvalue_fullcargo',
  'mixedcargo_generic_highvalue_halfcargo',
  'mixedcargo_generic_highvalue_minimalcargo',
  'mixedcargo_generic_highvalue_scraps',
  'mixedcargo_generic_lowvalue_fullcargo',
  'mixedcargo_generic_lowvalue_halfcargo',
  'mixedcargo_generic_lowvalue_minimalcargo',
  'mixedcargo_generic_lowvalue_scraps',
  'mixedcargo_generic_mediumvalue_fullcargo',
  'mixedcargo_generic_mediumvalue_halfcargo',
  'mixedcargo_generic_mediumvalue_minimumcargo',
  'mixedcargo_generic_mediumvalue_scrap',
]);
export type CargoManifestElement = z.infer<typeof CargoManifestElementSchema>;

export const ClassificationSchema = z.enum([
  'advocacy',
  'civilian',
  'criminal',
  'ninetails',
  'security',
  'uee',
  'unmanned',
  'vanduul',
  'xenothreat',
]);
export type Classification = z.infer<typeof ClassificationSchema>;

export const SystemSchema = z.enum(['Nyx', 'Pyro', 'Stanton']);
export type System = z.infer<typeof SystemSchema>;

export const TitleKeySchema = z.enum([
  '@Covalex_HaulCargo_AToB_Intro_title',
  '@Covalex_HaulCargo_AToB_Rehire_title',
  '@Covalex_HaulCargo_AToB_title',
  '@Covalex_HaulCargo_MultiToSingle_title',
  '@Covalex_HaulCargo_SingleToMulti_title',
]);
export type TitleKey = z.infer<typeof TitleKeySchema>;

export const TitleLocKeySchema = z.enum([
  'Covalex_HaulCargo_AToB_Intro_title',
  'Covalex_HaulCargo_AToB_Rehire_title',
  'Covalex_HaulCargo_AToB_title',
  'Covalex_HaulCargo_MultiToSingle_title',
  'Covalex_HaulCargo_SingleToMulti_title',
]);
export type TitleLocKey = z.infer<typeof TitleLocKeySchema>;

export const CargoGradeTokenSchema = z.enum([
  '@HaulCargo_CargoGrade_Bulk',
  '@HaulCargo_CargoGrade_ExtraSmall',
  '@HaulCargo_CargoGrade_Small',
  '@HaulCargo_CargoGrade_Supply',
]);
export type CargoGradeToken = z.infer<typeof CargoGradeTokenSchema>;

export const CargoRouteTokenSchema = z.enum([
  '@HaulCargo_CargoRoute_Local',
  '@HaulCargo_CargoRoute_Planetary',
  '@HaulCargo_CargoRoute_Solar',
]);
export type CargoRouteToken = z.infer<typeof CargoRouteTokenSchema>;

export const ItemEnumSchema = z.enum([
  '@items_commodities_aluminum',
  '@items_commodities_corundum',
  '@items_commodities_quartz',
  '@items_commodities_titanium',
  '@items_commodities_tungsten',
]);
export type ItemEnum = z.infer<typeof ItemEnumSchema>;

export const MissionMaxScuSizeSchema = z.enum([
  '@FreightElevator_16SCU',
  '@FreightElevator_1SCU',
  '@FreightElevator_32SCU',
  '@FreightElevator_4SCU',
  '@FreightElevator_8SCU',
]);
export type MissionMaxScuSize = z.infer<typeof MissionMaxScuSizeSchema>;

export const MultiToSingleTokenSchema = z.enum([
  '@HaulCargo_2_MultiToSingleToken',
  '@HaulCargo_3_MultiToSingleToken',
  '@HaulCargo_4_MultiToSingleToken',
]);
export type MultiToSingleToken = z.infer<typeof MultiToSingleTokenSchema>;

export const ReputationRankSchema = z.enum([
  '@RepStanding_TransportGuild_Rank0',
  '@RepStanding_TransportGuild_Rank1',
  '@RepStanding_TransportGuild_Rank2',
  '@RepStanding_TransportGuild_Rank3',
  '@RepStanding_TransportGuild_Rank4',
  '@RepStanding_TransportGuild_Rank5',
  '@RepStanding_TransportGuild_Rank6',
]);
export type ReputationRank = z.infer<typeof ReputationRankSchema>;

export const SingleToMultiTokenSchema = z.enum([
  '@HaulCargo_2_SingleToMultiToken',
  '@HaulCargo_3_SingleToMultiToken',
  '@HaulCargo_4_SingleToMultiToken',
]);
export type SingleToMultiToken = z.infer<typeof SingleToMultiTokenSchema>;

export const PlanetSchema = z.enum([
  'ArcCorp',
  'Bloom',
  'Crusader',
  'Hurston',
  'microTech',
  'Monox',
  'Pyro I',
  'Pyro II',
  'Pyro IV',
  'Pyro V',
  'Terminus',
]);
export type Planet = z.infer<typeof PlanetSchema>;

export const CareerSchema = z.enum([
  'Combat',
  'Competition',
  'Exploration',
  'Ground',
  'Gunship',
  'Industrial',
  'Multi-Role',
  'Starter',
  'Support',
  'Transport',
  'Transporter',
]);
export type Career = z.infer<typeof CareerSchema>;

// ---------------------------------------------------------------------------
// Resource pools (GUID-keyed record; entries have name + optional nameKey)
// ---------------------------------------------------------------------------

export const ResourcePoolEntrySchema = z.object({
  name: z.string(),
  nameKey: z.string().optional(),
});
export type ResourcePoolEntry = z.infer<typeof ResourcePoolEntrySchema>;

export const ResourcePoolsSchema = z.record(z.string(), ResourcePoolEntrySchema);
export type ResourcePools = z.infer<typeof ResourcePoolsSchema>;

// ---------------------------------------------------------------------------
// Blueprint pools (GUID-keyed record)
// ---------------------------------------------------------------------------

export const BlueprintItemSchema = z.object({
  weight: z.number(),
  name: z.union([z.null(), z.string()]).optional(),
});
export type BlueprintItem = z.infer<typeof BlueprintItemSchema>;

export const BlueprintPoolEntrySchema = z.object({
  name: z.string(),
  blueprints: z.array(BlueprintItemSchema),
  source: SourceSchema,
});
export type BlueprintPoolEntry = z.infer<typeof BlueprintPoolEntrySchema>;

export const BlueprintPoolsSchema = z.record(z.string(), BlueprintPoolEntrySchema);
export type BlueprintPools = z.infer<typeof BlueprintPoolsSchema>;

// ---------------------------------------------------------------------------
// Supporting schemas
// ---------------------------------------------------------------------------

export const AvailabilityPoolSchema = z.object({});
export type AvailabilityPool = z.infer<typeof AvailabilityPoolSchema>;

export const ResourceElementSchema = z.object({
  name: z.string(),
  prob: z.number(),
});
export type ResourceElement = z.infer<typeof ResourceElementSchema>;

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

export const FactionRewardsSchema = z.object({
  factionGuid: z.string(),
  scopeGuid: z.string(),
  amount: z.number(),
});
export type FactionRewards = z.infer<typeof FactionRewardsSchema>;

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

export const ItemSchema = z.object({
  name: z.string(),
  amount: z.number(),
  itemType: ItemTypeSchema.optional(),
  armorSlot: ArmorSlotSchema.optional(),
  armorClass: ArmorClassSchema.optional(),
});
export type Item = z.infer<typeof ItemSchema>;

export const EdIntroSchema = z.object({
  debugName: z.string(),
  title: z.string().optional(),
});
export type EdIntro = z.infer<typeof EdIntroSchema>;

export const LocationSetSchema = z.object({
  locations: z.union([z.array(z.string()), z.null()]),
  destinations: z.union([z.array(z.string()), z.null()]).optional(),
});
export type LocationSet = z.infer<typeof LocationSetSchema>;

export const StandingSchema = z.object({
  guid: z.string(),
  name: MinStandingNameSchema,
  minReputation: z.number(),
  nameKey: NameKeySchema,
  includeWhenSharing: z.boolean().optional(),
});
export type Standing = z.infer<typeof StandingSchema>;

export const MinStandingSchema = z.object({
  guid: z.string(),
  name: z.string(),
  minReputation: z.number(),
  nameKey: z.string(),
  scopeName: ScopeNameSchema.optional(),
  scopeGuid: z.string().optional(),
  includeWhenSharing: z.boolean(),
});
export type MinStanding = z.infer<typeof MinStandingSchema>;

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

export const ResolvedLocationElementSchema = z.object({
  name: z.string(),
  navIcon: NavIconEnumSchema,
});
export type ResolvedLocationElement = z.infer<typeof ResolvedLocationElementSchema>;

export const LocationPropertySchema = z.object({
  resolvedLocations: z.union([z.array(ResolvedLocationElementSchema), z.null()]),
});
export type LocationProperty = z.infer<typeof LocationPropertySchema>;

export const StarElementSchema = z.object({
  guid: z.string(),
  name: z.string(),
  navIcon: NavIconEnumSchema,
});
export type StarElement = z.infer<typeof StarElementSchema>;

export const SubLocationVariantSchema = z.object({
  guid: z.string(),
  name: PlanetEnumSchema,
  navIcon: NavIconEnumSchema,
  star: StarElementSchema.optional(),
  planet: StarElementSchema.optional(),
});
export type SubLocationVariant = z.infer<typeof SubLocationVariantSchema>;

export const TagSearchLocationSchema = z.object({
  system: z.union([PlanetEnumSchema, z.null()]),
  planet: z.union([PlanetEnumSchema, z.null()]),
});
export type TagSearchLocation = z.infer<typeof TagSearchLocationSchema>;

export const RequiredScenarioSchema = z.object({
  name: RequiredScenarioNameSchema,
  enabled: z.boolean(),
});
export type RequiredScenario = z.infer<typeof RequiredScenarioSchema>;

export const SlotSchema = z.object({
  poolId: z.string(),
  minCount: z.number(),
  maxCount: z.number(),
});
export type Slot = z.infer<typeof SlotSchema>;

export const TierSchema = z.object({
  minPoints: z.number(),
  badge: z.string(),
});
export type Tier = z.infer<typeof TierSchema>;

export const FactionSchema = z.object({
  name: z.string(),
  nameKey: z.union([z.null(), z.string()]),
  isNPC: z.string(),
  logo: z.union([z.null(), z.string()]),
});
export type Faction = z.infer<typeof FactionSchema>;

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

export const LocationPoolSchema = z.object({
  name: z.string(),
  type: NavIconEnumSchema,
  system: z.union([SystemSchema, z.null()]),
  planet: z.union([PlanetSchema, z.null()]),
  moon: z.union([z.null(), z.string()]),
});
export type LocationPool = z.infer<typeof LocationPoolSchema>;

export const ReputationMultiplierSchema = z.object({
  reputationRewardMultiplier: z.number(),
});
export type ReputationMultiplier = z.infer<typeof ReputationMultiplierSchema>;

export const RankSchema = z.object({
  guid: z.string(),
  name: z.string(),
  nameKey: z.string(),
  minReputation: z.number(),
  rangeXP: z.union([z.number(), z.null()]),
  rankIndex: z.number(),
});
export type Rank = z.infer<typeof RankSchema>;

export const ShipSchema = z.object({
  name: z.string(),
  career: CareerSchema,
  role: z.string(),
});
export type Ship = z.infer<typeof ShipSchema>;

export const CargoManifestPoolSchema = z.object({
  fillType: FillTypeSchema,
  fillMin: z.number(),
  fillMax: z.number(),
  resources: z.array(ResourceElementSchema),
});
export type CargoManifestPool = z.infer<typeof CargoManifestPoolSchema>;

export const ItemRewardGroupSchema = z.object({
  weighting: z.number(),
  probability: z.number(),
  items: z.array(ItemSchema),
});
export type ItemRewardGroup = z.infer<typeof ItemRewardGroupSchema>;

export const PropertyLocationSchema = z.object({
  star: StarElementSchema.optional(),
});
export type PropertyLocation = z.infer<typeof PropertyLocationSchema>;

export const WaveSchema = z.object({
  name: z.union([z.null(), z.string()]),
  minShips: z.number(),
  maxShips: z.number(),
  slots: z.array(SlotSchema).optional(),
});
export type Wave = z.infer<typeof WaveSchema>;

export const EventScopeSchema = z.object({
  eventName: z.string(),
  category: z.union([z.null(), z.string()]),
  tiers: z.array(TierSchema),
});
export type EventScope = z.infer<typeof EventScopeSchema>;

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

export const PartialRewardPayoutPoolSchema = z.object({
  minPercentage: z.number(),
  maxPercentage: z.number(),
  currencyRewardMultiplier: z.number(),
  reputationMultipliers: z.union([z.array(ReputationMultiplierSchema), z.null()]),
});
export type PartialRewardPayoutPool = z.infer<typeof PartialRewardPayoutPoolSchema>;

export const PyroRegionAreaSchema = z.object({
  guid: z.string(),
  locations: z.array(StarElementSchema),
});

export const PyroRegionsSchema = z.object({
  A: PyroRegionAreaSchema,
  B: PyroRegionAreaSchema,
  C: PyroRegionAreaSchema,
  D: PyroRegionAreaSchema,
});
export type PyroRegions = z.infer<typeof PyroRegionsSchema>;

export const ScopeSchema = z.object({
  scopeName: ScopeNameSchema,
  ranks: z.array(RankSchema),
});
export type Scope = z.infer<typeof ScopeSchema>;

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

export const SpawnConfigGroupSchema = z.object({
  role: z.string(),
  poolId: z.string(),
  waves: z.array(WaveSchema),
  classification: ClassificationSchema,
  cargoManifest: z.union([z.array(CargoManifestElementSchema), CargoManifestElementSchema]).optional(),
  spawnChance: z.number().optional(),
});
export type SpawnConfigGroup = z.infer<typeof SpawnConfigGroupSchema>;

export const SpawnConfigSchema = z.object({
  groups: z.array(SpawnConfigGroupSchema),
  waveDelay: z.union([z.number(), z.null()]),
  numberOfWaves: z.union([z.number(), z.null()]),
  totalMinShips: z.number(),
  totalMaxShips: z.number(),
});
export type SpawnConfig = z.infer<typeof SpawnConfigSchema>;

export const ShipEncountersSchema = z.object({
  spawnConfig: SpawnConfigSchema,
});
export type ShipEncounters = z.infer<typeof ShipEncountersSchema>;

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
  rewardRepCalculated: z.union([z.number(), z.null()]),
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

// ---------------------------------------------------------------------------
// Top-level schema
// ---------------------------------------------------------------------------

export const MergedSchema = z.object({
  version: z.string(),
  scopes: z.record(z.string(), ScopeSchema),
  eventScopes: z.record(z.string(), EventScopeSchema),
  locationPools: z.record(z.string(), LocationPoolSchema),
  resourcePools: ResourcePoolsSchema,
  blueprintPools: BlueprintPoolsSchema,
  shipPools: z.record(z.string(), z.array(z.string())),
  cargoManifestPools: z.record(z.string(), CargoManifestPoolSchema),
  partialRewardPayoutPools: z.array(z.array(PartialRewardPayoutPoolSchema)),
  availabilityPools: z.array(AvailabilityPoolSchema),
  factionRewardsPools: z.array(z.array(FactionRewardsSchema)),
  pyroRegions: PyroRegionsSchema,
  factions: z.record(z.string(), FactionSchema),
  ships: z.record(z.string(), z.array(ShipSchema)),
  contracts: z.array(ContractSchema),
  legacyContracts: z.array(LegacyContractSchema),
});
export type Merged = z.infer<typeof MergedSchema>;
