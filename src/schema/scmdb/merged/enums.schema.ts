import { z } from 'zod';

// ---------------------------------------------------------------------------
// Simple enum schemas used across the merged data domain.
// All other merged schemas import from here — no reverse dependencies.
// ---------------------------------------------------------------------------

export const SourceSchema = z.enum(['blueprintmissionpools', 'collectorwikelo', '48blueprints', 'xenothreat2rewards']);
export type Source = z.infer<typeof SourceSchema>;

export const FillTypeSchema = z.enum(['custom', 'even', 'random']);
export type FillType = z.infer<typeof FillTypeSchema>;

export const TriggerSchema = z.enum(['accept', 'complete']);
export type Trigger = z.infer<typeof TriggerSchema>;

export const CategorySchema = z.enum(['career', 'event', 'story']);
export type Category = z.infer<typeof CategorySchema>;

export const HaulingOrdersTypeSchema = z.enum(['or']);
export type HaulingOrdersType = z.infer<typeof HaulingOrdersTypeSchema>;

export const ArmorClassSchema = z.enum(['heavy', 'helmet', 'light', 'medium']);
export type ArmorClass = z.infer<typeof ArmorClassSchema>;

export const ArmorSlotSchema = z.enum(['arms', 'backpack', 'chest', 'helmet', 'legs', 'undersuit']);
export type ArmorSlot = z.infer<typeof ArmorSlotSchema>;

export const ItemTypeSchema = z.enum(['armor', 'clothing', 'vehicle', 'weapon', 'weapon_attachment']);
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
  'shipheist/shipheist_freelancer_easy',
  'shipheist/shipheist_freelancer_hard',
  'shipheist/shipheist_freelancer_medium',
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
