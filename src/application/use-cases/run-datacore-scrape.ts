import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { stringify } from 'csv-stringify/sync';
import {
  ensureToolsInstalled,
  readGameVersion,
  resolveLiveDir,
  runTool,
  type Unp4kTools,
} from '../../io/local/unp4k-tool';
import type {
  DataCoreFieldReferenceSelector,
  DataCoreFieldSelector,
  DataCoreItemTypeConfig,
} from '../../items/datacore/types';
import { extractDataCoreXmlCache } from '../../sources/datacore/acquisition';
import { extractDataCoreCommodities } from '../../sources/datacore/commodity-extractor';
import { extractDataCoreContractGenerators } from '../../sources/datacore/contract-generator-extractor';
import { extractDataCoreContractTemplates } from '../../sources/datacore/contract-template-extractor';
import { extractDataCoreFactions } from '../../sources/datacore/faction-extractor';
import { extractDataCoreLocationLabels } from '../../sources/datacore/location-label-extractor';
import { extractDataCoreManufacturers } from '../../sources/datacore/manufacturer-extractor';
import {
  createDataCoreManufacturerResolver,
  type DataCoreManufacturerResolver,
} from '../../sources/datacore/manufacturer-resolver';
import { extractDataCoreMineableEntities } from '../../sources/datacore/mineable-entity-extractor';
import { extractDataCoreMiningClustering } from '../../sources/datacore/mining-clustering-extractor';
import { extractDataCoreMiningCompositions } from '../../sources/datacore/mining-composition-extractor';
import { extractDataCoreMiningDensityOverrides } from '../../sources/datacore/mining-density-override-extractor';
import { extractDataCoreMiningElements } from '../../sources/datacore/mining-element-extractor';
import { extractDataCoreMiningHarvestablePresets } from '../../sources/datacore/mining-harvestable-preset-extractor';
import { extractDataCoreMiningHarvestableSetups } from '../../sources/datacore/mining-harvestable-setup-extractor';
import { extractDataCoreMiningLocationLabels } from '../../sources/datacore/mining-location-label-extractor';
import { extractDataCoreMiningParams } from '../../sources/datacore/mining-param-extractor';
import { extractDataCoreMiningProviderPresets } from '../../sources/datacore/mining-provider-preset-extractor';
import { extractDataCoreMiningQualityDistributions } from '../../sources/datacore/mining-quality-distribution-extractor';
import { extractDataCoreMiningQualityQuantizations } from '../../sources/datacore/mining-quality-quantization-extractor';
import { extractDataCoreMiningRockSignatures } from '../../sources/datacore/mining-rock-signature-extractor';
import { extractDataCoreMiningSubHarvestableConfigs } from '../../sources/datacore/mining-sub-harvestable-config-extractor';
import { extractDataCoreMissionBrokers } from '../../sources/datacore/mission-broker-extractor';
import { extractDataCoreMissionLocalization } from '../../sources/datacore/mission-localization-extractor';
import {
  type BuildDataCoreRecordGraphOptions,
  buildDataCoreRecordGraph,
  writeDataCoreRecordGraph,
} from '../../sources/datacore/record-graph';
import { createDataCoreRecordGraphLookup } from '../../sources/datacore/record-graph-loader';
import type {
  DataCoreCommodityRecord,
  DataCoreContractGeneratorRecord,
  DataCoreContractTemplateRecord,
  DataCoreFactionRecord,
  DataCoreLocationLabelRecord,
  DataCoreManufacturerRecord,
  DataCoreMineableEntityRecord,
  DataCoreMiningClusteringParamRecord,
  DataCoreMiningCompositionPartRecord,
  DataCoreMiningDensityOverrideRecord,
  DataCoreMiningElementRecord,
  DataCoreMiningHarvestablePresetRecord,
  DataCoreMiningHarvestableSetupRecord,
  DataCoreMiningLocationLabelRecord,
  DataCoreMiningParamRecord,
  DataCoreMiningProviderPresetRecord,
  DataCoreMiningQualityDistributionRecord,
  DataCoreMiningQualityQuantizationRecord,
  DataCoreMiningRockSignatureRecord,
  DataCoreMiningSubHarvestableConfigRecord,
  DataCoreMissionBrokerRecord,
  DataCoreMissionLocalizationRecord,
  DataCoreRecordGraph,
  DataCoreRecordGraphLookup,
  DataCoreVehicleRecord,
} from '../../sources/datacore/types';
import { extractDataCoreVehicles } from '../../sources/datacore/vehicle-extractor';
import { collectDataCoreXmlFilesMatching, countDataCoreXmlFiles } from '../../sources/datacore/xml-files';
import {
  extractAttachDef,
  extractEntityClass,
  extractHealth,
  loadXml,
  xmlVal,
} from '../../sources/datacore/xml-parser';
import { DATACORE_RAW_FACTS } from './category-listing';

export interface DataCoreTypeEntry {
  name: string;
  csvFile: string;
  typeConfig: DataCoreItemTypeConfig;
}

export interface DataCoreScrapeTypeResult {
  type: string;
  rows: number;
  skipped: number;
  csvFile: string;
}

export interface DataCoreScrapeCommodityResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeContractGeneratorResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeContractTemplateResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeVehicleResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeFactionResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeManufacturerResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeLocationLabelResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeMissionLocalizationResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeMissionBrokerResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeMiningElementResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeMiningCompositionResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeMineableEntityResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeMiningDensityOverrideResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeMiningClusteringResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeMiningHarvestablePresetResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeMiningHarvestableSetupResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeMiningSubHarvestableConfigResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeMiningQualityDistributionResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeMiningQualityQuantizationResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeMiningRockSignatureResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeMiningLocationLabelResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeMiningParamResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeMiningProviderPresetResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreRawFactScrapeResult {
  slug: string;
  label: string;
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeTypeError {
  type: string;
  message: string;
}

export interface RunDatacoreScrapeOptions {
  repoRoot: string;
  binDirname?: string;
  ptu?: boolean;
  dryRun?: boolean;
  forceExtract?: boolean;
  types?: string[];
  loadTypes?: (repoRoot: string) => Promise<DataCoreTypeEntry[]>;
  resolveLiveDir?: (binDirname: string) => string;
  readGameVersion?: (liveDir: string) => Promise<string>;
  /** Test-only fallback. Production DataCore acquisition extracts Game2.dcb from Data.p4k. */
  findDcbFile?: (liveDir: string) => Promise<string>;
  ensureTools?: (toolDir: string, log: (message: string) => void) => Promise<Unp4kTools>;
  extractPackedDcb?: (p4kPath: string, dcbCacheDir: string, tools: Unp4kTools) => void | Promise<void>;
  countXmlFiles?: (xmlCacheDir: string) => Promise<number>;
  extractXmlCache?: typeof extractDataCoreXmlCache;
  buildRecordGraph?: (options: BuildDataCoreRecordGraphOptions) => Promise<DataCoreRecordGraph>;
  writeRecordGraph?: (graph: DataCoreRecordGraph, outputPath: string) => Promise<void>;
  extractContractGenerators?: typeof extractDataCoreContractGenerators;
  extractContractTemplates?: typeof extractDataCoreContractTemplates;
  extractCommodities?: typeof extractDataCoreCommodities;
  extractVehicles?: typeof extractDataCoreVehicles;
  extractFactions?: typeof extractDataCoreFactions;
  extractManufacturers?: typeof extractDataCoreManufacturers;
  extractMissionBrokers?: typeof extractDataCoreMissionBrokers;
  extractMissionLocalization?: typeof extractDataCoreMissionLocalization;
  extractLocationLabels?: typeof extractDataCoreLocationLabels;
  extractMiningElements?: typeof extractDataCoreMiningElements;
  extractMiningCompositions?: typeof extractDataCoreMiningCompositions;
  extractMineableEntities?: typeof extractDataCoreMineableEntities;
  extractMiningDensityOverrides?: typeof extractDataCoreMiningDensityOverrides;
  extractMiningClustering?: typeof extractDataCoreMiningClustering;
  extractMiningHarvestablePresets?: typeof extractDataCoreMiningHarvestablePresets;
  extractMiningHarvestableSetups?: typeof extractDataCoreMiningHarvestableSetups;
  extractMiningSubHarvestableConfigs?: typeof extractDataCoreMiningSubHarvestableConfigs;
  extractMiningQualityDistributions?: typeof extractDataCoreMiningQualityDistributions;
  extractMiningQualityQuantizations?: typeof extractDataCoreMiningQualityQuantizations;
  extractMiningRockSignatures?: typeof extractDataCoreMiningRockSignatures;
  extractMiningLocationLabels?: typeof extractDataCoreMiningLocationLabels;
  extractMiningParams?: typeof extractDataCoreMiningParams;
  extractMiningProviderPresets?: typeof extractDataCoreMiningProviderPresets;
  onPrepared?: (context: {
    gameVersion: string;
    channel: 'live' | 'ptu';
    dcbPath: string;
    outputBase: string;
    xmlCacheDir: string;
    selectedTypes: DataCoreTypeEntry[];
    allTypes: DataCoreTypeEntry[];
    dryRun: boolean;
  }) => void;
  onToolsLog?: (message: string) => void;
  onToolsReady?: (tools: Unp4kTools) => void;
  onTypeStart?: (entry: DataCoreTypeEntry, index: number) => void;
  onCacheHit?: (count: number, xmlCacheDir: string) => void;
  onCacheExtractStart?: (dcbPath: string, xmlCacheDir: string, clearExisting: boolean) => void;
  onCacheExtractComplete?: (count: number) => void;
  onRecordGraphBuilt?: (recordCount: number, outputPath: string, dryRun: boolean) => void;
  onContractGeneratorsExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onContractTemplatesExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onCommoditiesExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onVehiclesExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onFactionsExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onManufacturersExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onLocationLabelsExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onMissionBrokersExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onMissionLocalizationExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onMiningElementsExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onMiningCompositionsExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onMineableEntitiesExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onMiningDensityOverridesExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onMiningClusteringExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onMiningHarvestablePresetsExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onMiningHarvestableSetupsExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onMiningSubHarvestableConfigsExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onMiningQualityDistributionsExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onMiningQualityQuantizationsExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onMiningRockSignaturesExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onMiningLocationLabelsExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onMiningParamsExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onMiningProviderPresetsExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
}

export interface RunDatacoreScrapeResult {
  exitCode: number;
  gameVersion: string;
  channel: 'live' | 'ptu';
  versionTag: string;
  dcbPath: string;
  outputBase: string;
  xmlCacheDir: string;
  allTypes: DataCoreTypeEntry[];
  selectedTypes: DataCoreTypeEntry[];
  recordGraph: {
    recordCount: number;
    outputPath: string;
  };
  contractGeneratorResult: DataCoreScrapeContractGeneratorResult;
  contractTemplateResult: DataCoreScrapeContractTemplateResult;
  commodityResult: DataCoreScrapeCommodityResult;
  vehicleResult: DataCoreScrapeVehicleResult;
  factionResult: DataCoreScrapeFactionResult;
  manufacturerResult: DataCoreScrapeManufacturerResult;
  locationLabelResult: DataCoreScrapeLocationLabelResult;
  missionBrokerResult: DataCoreScrapeMissionBrokerResult;
  missionLocalizationResult: DataCoreScrapeMissionLocalizationResult;
  miningElementResult: DataCoreScrapeMiningElementResult;
  miningCompositionResult: DataCoreScrapeMiningCompositionResult;
  mineableEntityResult: DataCoreScrapeMineableEntityResult;
  miningDensityOverrideResult: DataCoreScrapeMiningDensityOverrideResult;
  miningClusteringResult: DataCoreScrapeMiningClusteringResult;
  miningHarvestablePresetResult: DataCoreScrapeMiningHarvestablePresetResult;
  miningHarvestableSetupResult: DataCoreScrapeMiningHarvestableSetupResult;
  miningSubHarvestableConfigResult: DataCoreScrapeMiningSubHarvestableConfigResult;
  miningQualityDistributionResult: DataCoreScrapeMiningQualityDistributionResult;
  miningQualityQuantizationResult: DataCoreScrapeMiningQualityQuantizationResult;
  miningRockSignatureResult: DataCoreScrapeMiningRockSignatureResult;
  miningLocationLabelResult: DataCoreScrapeMiningLocationLabelResult;
  miningParamResult: DataCoreScrapeMiningParamResult;
  miningProviderPresetResult: DataCoreScrapeMiningProviderPresetResult;
  rawFactResults: DataCoreRawFactScrapeResult[];
  results: DataCoreScrapeTypeResult[];
  errors: DataCoreScrapeTypeError[];
}

const COMMON_HEADERS = [
  'Entity Class',
  'Name Key',
  'Short Name Key',
  'Description Key',
  'Manufacturer',
  'Size',
  'Grade',
  'Class',
  'Health',
];
const CONTRACT_GENERATORS_CSV_FILE = 'contract-generators.datacore.csv';
const CONTRACT_TEMPLATES_CSV_FILE = 'contract-templates.datacore.csv';
const COMMODITY_CSV_FILE = 'commodities.datacore.csv';
const VEHICLES_CSV_FILE = 'vehicles.datacore.csv';
const FACTIONS_CSV_FILE = 'factions.datacore.csv';
const MANUFACTURERS_CSV_FILE = 'manufacturers.datacore.csv';
const LOCATION_LABELS_CSV_FILE = 'location-labels.datacore.csv';
const MISSION_BROKERS_CSV_FILE = 'mission-brokers.datacore.csv';
const MISSION_LOCALIZATION_CSV_FILE = 'mission-localization.datacore.csv';
const MINING_ELEMENTS_CSV_FILE = 'mining-elements.datacore.csv';
const MINING_COMPOSITIONS_CSV_FILE = 'mining-compositions.datacore.csv';
const MINEABLE_ENTITIES_CSV_FILE = 'mineable-entities.datacore.csv';
const MINING_DENSITY_OVERRIDES_CSV_FILE = 'mining-density-overrides.datacore.csv';
const MINING_CLUSTERING_CSV_FILE = 'mining-clustering.datacore.csv';
const MINING_HARVESTABLE_PRESETS_CSV_FILE = 'mining-harvestable-presets.datacore.csv';
const MINING_HARVESTABLE_SETUPS_CSV_FILE = 'mining-harvestable-setups.datacore.csv';
const MINING_SUB_HARVESTABLE_CONFIGS_CSV_FILE = 'mining-sub-harvestable-configs.datacore.csv';
const MINING_QUALITY_DISTRIBUTIONS_CSV_FILE = 'mining-quality-distributions.datacore.csv';
const MINING_QUALITY_QUANTIZATIONS_CSV_FILE = 'mining-quality-quantizations.datacore.csv';
const MINING_ROCK_SIGNATURES_CSV_FILE = 'mining-rock-signatures.datacore.csv';
const MINING_LOCATION_LABELS_CSV_FILE = 'mining-location-labels.datacore.csv';
const MINING_PARAMS_CSV_FILE = 'mining-params.datacore.csv';
const MINING_PROVIDER_PRESETS_CSV_FILE = 'mining-provider-presets.datacore.csv';
const COMMODITY_HEADERS = [
  'Entity Class',
  'Name Key',
  'Description Key',
  'Display Name Key',
  'Display Description Key',
  'Display Type Key',
  'Type GUID',
  'Subtype GUID',
  'Cargo Occupancy Unit',
  'Cargo Occupancy Value',
  'Cargo Occupancy SCU',
  'Boxable',
  'Unrefined',
  'Raw',
  'Refined',
  'Record GUID',
  'Record Path',
];
const CONTRACT_GENERATOR_HEADERS = [
  'Generator Class',
  'Handler Type',
  'Handler Debug Name',
  'Handler Not For Release',
  'Handler Work In Progress',
  'Faction Reputation GUID',
  'Reputation Scope GUID',
  'Contract Section',
  'Contract ID',
  'Contract Debug Name',
  'Contract Not For Release',
  'Contract Work In Progress',
  'Template GUID',
  'Template Class',
  'Title Key',
  'Description Key',
  'Contractor Key',
  'Title Variant Keys',
  'Description Variant Keys',
  'String Param Overrides',
  'Location Tag GUIDs',
  'Location Tag Classes',
  'Max Instances',
  'Max Instances Per Player',
  'Respawn Time',
  'Respawn Time Variation',
  'Instance Life Time',
  'Instance Life Time Variation',
  'Contract Buy In Amount',
  'Time To Complete',
  'Difficulty Profile GUID',
  'Difficulty Profile Class',
  'Mechanical Skill',
  'Mental Load',
  'Risk Of Loss',
  'Game Knowledge',
  'Record GUID',
  'Record Path',
];
const CONTRACT_TEMPLATE_HEADERS = [
  'Template Class',
  'Contract Class Type',
  'Owner GUID',
  'Owner Class',
  'Display Type GUID',
  'Display Type Class',
  'Illegal',
  'Show Life Time In MobiGlas',
  'Pre Show Objectives',
  'Has Complete Button',
  'Handles Abandon Request',
  'Can Be Shared',
  'Display Allied Markers',
  'Only Owner Can Complete',
  'Fail If Sent To Prison',
  'Fail If Became Criminal',
  'Fail If Leave Prison',
  'Mission Completion Time',
  'Mission Auto End',
  'Mission Result After Timer End',
  'Remaining Time To Show Timer',
  'Objective Count',
  'Mission Property Count',
  'Objective Handler Types',
  'Objective Handler Modules',
  'Objective Display Keys',
  'Travel Objective Keys',
  'Return Objective Keys',
  'Override Mission Details Keys',
  'Nav Point Name Keys',
  'String Hash Keys',
  'Location Tag GUIDs',
  'Location Tag Classes',
  'Record GUID',
  'Record Path',
];
const VEHICLE_HEADERS = [
  'Entity Class',
  'Vehicle Name Key',
  'Vehicle Description Key',
  'Manufacturer GUID',
  'Manufacturer Code',
  'Manufacturer Name Key',
  'Movement Class',
  'Vehicle Definition',
  'Modification',
  'Career Key',
  'Career GUID',
  'Role Key',
  'Role GUID',
  'Crew Size',
  'Hull Damage Normalization',
  'Allow Soft Destruction',
  'Dogfight Enabled',
  'Gravlev Vehicle',
  'Inventory Container GUID',
  'Record GUID',
  'Record Path',
];
const FACTION_HEADERS = [
  'Faction Class',
  'Name Key',
  'Description Key',
  'Default Reaction',
  'Faction Type',
  'Able To Arrest',
  'Polices Lawful Trespass',
  'Polices Criminality',
  'No Legal Rights',
  'Faction Reputation GUID',
  'Faction Reputation Class',
  'Faction Reputation Path',
  'Reputation Display Name Key',
  'Reputation Description Key',
  'Reputation Headquarters Key',
  'Reputation Founded Key',
  'Reputation Leadership Key',
  'Reputation Area Key',
  'Reputation Focus Key',
  'Reputation Lawful',
  'Allied Faction GUIDs',
  'Enemy Faction GUIDs',
  'Record GUID',
  'Record Path',
];
const MANUFACTURER_HEADERS = [
  'Manufacturer Class',
  'Code',
  'Name Key',
  'Short Name Key',
  'Description Key',
  'Logo',
  'Logo Full Color',
  'Logo Simplified White',
  'Dashboard Canvas Config GUID',
  'Building Blocks Style GUID',
  'Audio Manufacturer Tag GUID',
  'Light Amplification GUID',
  'Record GUID',
  'Record Path',
];
const LOCATION_LABEL_HEADERS = [
  'Location Class',
  'Name Key',
  'Description Key',
  'Callout 1 Key',
  'Callout 2 Key',
  'Callout 3 Key',
  'Type GUID',
  'Parent GUID',
  'Parent Class',
  'Parent Path',
  'Affiliation GUID',
  'Affiliation Class',
  'Affiliation Path',
  'Affiliation Name Key',
  'Jurisdiction GUID',
  'Jurisdiction Class',
  'Jurisdiction Path',
  'Jurisdiction Name Key',
  'Respawn Location Type',
  'Location Hierarchy Tag',
  'Nav Icon',
  'Size',
  'Hide In Starmap',
  'Hide In World',
  'Hide When In Adoption Radius',
  'Only Show When Parent Selected',
  'Override Show In All Zones',
  'Override Permanent',
  'Minimum Display Size',
  'Block Travel',
  'Is Scannable',
  'Show Orbit Line',
  'Use Holo Material',
  'No Auto Body Recovery',
  'Arrival Radius',
  'Adoption Radius',
  'Set Entity Location On Enter',
  'Expose For Player Created Missions',
  'StarMap Geom Path',
  'StarMap Material Path',
  'StarMap Shape Path',
  'Location Image Path',
  'Record GUID',
  'Record Path',
];
const MISSION_LOCALIZATION_HEADERS = [
  'Localization Key',
  'Localization Role',
  'Attribute',
  'Record Type',
  'Entity Class',
  'Record GUID',
  'Record Path',
];
const MISSION_BROKER_HEADERS = [
  'Mission Class',
  'Title Key',
  'Title HUD Key',
  'Description Key',
  'Mission Giver Key',
  'Comms Channel Name Key',
  'Mission Module',
  'Mission Type GUID',
  'Mission Type Class',
  'Owner GUID',
  'Owner Class',
  'Mission Giver Record GUID',
  'Mission Giver Record Class',
  'Location Mission Available GUID',
  'Location Mission Available Class',
  'Mission Difficulty',
  'Reward',
  'Reward Max',
  'Reward Plus Bonuses',
  'Currency Type',
  'Mission Completion Time',
  'Mission Auto End',
  'Mission Result After Timer End',
  'Remaining Time To Show Timer',
  'Initially Active',
  'Notify On Available',
  'Show As Offer',
  'Request Only',
  'Lawful Mission',
  'Max Instances',
  'Max Players Per Instance',
  'Max Instances Per Player',
  'Can Be Shared',
  'Once Only',
  'Tutorial',
  'Available In Prison',
  'Fail If Sent To Prison',
  'Fail If Became Criminal',
  'Fail If Leave Prison',
  'Respawn Time',
  'Respawn Time Variation',
  'Instance Has Life Time',
  'Show Life Time In MobiGlas',
  'Instance Life Time',
  'Instance Life Time Variation',
  'Can Reaccept After Abandoning',
  'Abandoned Cooldown Time',
  'Abandoned Cooldown Time Variation',
  'Can Reaccept After Failing',
  'Has Personal Cooldown',
  'Personal Cooldown Time',
  'Personal Cooldown Time Variation',
  'Record GUID',
  'Record Path',
];
const MINING_ELEMENT_HEADERS = [
  'Element Class',
  'Element Name',
  'Material Name',
  'Inferred Description Key',
  'Resource Type GUID',
  'Instability',
  'Resistance',
  'Optimal Window Midpoint',
  'Optimal Window Randomness',
  'Optimal Window Thinness',
  'Explosion Multiplier',
  'Cluster Factor',
  'Record GUID',
  'Record Path',
];
const MINING_COMPOSITION_HEADERS = [
  'Composition Class',
  'Deposit Name Key',
  'Minimum Distinct Elements',
  'Part Index',
  'Mineable Element GUID',
  'Mineable Element Class',
  'Mineable Element Name',
  'Min Percentage',
  'Max Percentage',
  'Probability',
  'Curve Exponent',
  'Quality Scale',
  'Record GUID',
  'Record Path',
];
const MINEABLE_ENTITY_HEADERS = [
  'Entity Class',
  'Composition GUID',
  'Composition Class',
  'Global Params GUID',
  'Global Params Class',
  'Audio Params GUID',
  'Audio Params Class',
  'Density Class GUID',
  'Density Class',
  'Filled Factor',
  'Glow Curve Power',
  'Glow Lerp Speed',
  'Allow Auto Respawning',
  'Record GUID',
  'Record Path',
];
const MINING_DENSITY_OVERRIDE_HEADERS = [
  'Override Class',
  'Density Class GUID',
  'Density Class',
  'Density Class Path',
  'Lifetime Days',
  'Lifetime Hours',
  'Lifetime Minutes',
  'Lifetime Seconds',
  'Lifetime Total Seconds',
  'Record GUID',
  'Record Path',
];
const MINING_CLUSTERING_HEADERS = [
  'Clustering Class',
  'Probability Of Clustering',
  'Param Index',
  'Relative Probability',
  'Min Size',
  'Max Size',
  'Min Proximity',
  'Max Proximity',
  'Record GUID',
  'Record Path',
];
const MINING_HARVESTABLE_PRESET_HEADERS = [
  'Harvestable Preset Class',
  'Harvestable Entity GUID',
  'Harvestable Entity Class',
  'Harvestable Entity Path',
  'Respawn In Slot Time',
  'Special Harvestable String',
  'Record GUID',
  'Record Path',
];
const MINING_HARVESTABLE_SETUP_HEADERS = [
  'Setup Class',
  'Respawn In Slot Time',
  'Special Harvestable String',
  'Harvest Condition Types',
  'Health Ratio',
  'Include Attached Children',
  'All Interactions Clear Spawn Point',
  'Movement Distance',
  'Despawn Time Seconds',
  'Additional Wait For Nearby Players Seconds',
  'Min Scale',
  'Max Scale',
  'Terrain Normal Alignment',
  'Min Z Offset',
  'Max Z Offset',
  'Min Slope',
  'Max Slope',
  'Min Elevation',
  'Max Elevation',
  'Local Rotation Offset',
  'Rotation Range',
  'Position Offset',
  'Record GUID',
  'Record Path',
];
const MINING_SUB_HARVESTABLE_CONFIG_HEADERS = [
  'Config Class',
  'Config Type',
  'Tagged Config Name',
  'Tag GUIDs',
  'Initial Slots Probability',
  'Config Respawn Time Multiplier',
  'Slot Index',
  'Harvestable GUID',
  'Harvestable Class',
  'Harvestable Path',
  'Harvestable Entity GUID',
  'Harvestable Entity Class',
  'Harvestable Entity Path',
  'Harvestable Setup GUID',
  'Harvestable Setup Class',
  'Relative Probability',
  'Deepest Relative Probability',
  'Harvestable Respawn Time Multiplier',
  'Geometry Tags',
  'Referenced Config GUID',
  'Referenced Config Class',
  'Referenced Config Path',
  'Record GUID',
  'Record Path',
];
const MINING_QUALITY_DISTRIBUTION_HEADERS = [
  'Distribution Class',
  'Distribution Type',
  'Mineable Family',
  'Location GUID',
  'Location Class',
  'Location Path',
  'Min Quality',
  'Max Quality',
  'Mean',
  'Stddev',
  'Record GUID',
  'Record Path',
];
const MINING_ROCK_SIGNATURE_HEADERS = [
  'Entity Class',
  'Variant Family',
  'Rarity',
  'Element Token',
  'Scan Signature',
  'Record GUID',
  'Record Path',
];
const MINING_QUALITY_QUANTIZATION_HEADERS = [
  'Quantization Class',
  'Element Token',
  'Quality Bands',
  'Band Ranges',
  'Record GUID',
  'Record Path',
];
const MINING_LOCATION_LABEL_HEADERS = [
  'Location Class',
  'Source Reason',
  'Name Key',
  'Description Key',
  'Callout 1 Key',
  'Callout 2 Key',
  'Callout 3 Key',
  'Type GUID',
  'Parent GUID',
  'Parent Class',
  'Parent Path',
  'Location Hierarchy Tag',
  'Nav Icon',
  'Size',
  'Hide In Starmap',
  'Hide In World',
  'Is Scannable',
  'Block Travel',
  'Arrival Radius',
  'Adoption Radius',
  'Set Entity Location On Enter',
  'Expose For Player Created Missions',
  'Record GUID',
  'Record Path',
];
const MINING_PARAM_HEADERS = [
  'Param Type',
  'Param Class',
  'Highlight Occluded Alpha',
  'Highlight Outline Width',
  'Highlight Distant Mineables Range',
  'Show Child Rock Radar Icon',
  'Scale Power Graph Min',
  'No Progress Hint Time',
  'No Progress Hint Power',
  'Fracture Done Feedback Duration',
  'Max Scan Raycast Distance',
  'Highlight Color',
  'Highlight Color Absorbable',
  'Highlight Color Distant',
  'Highlight Color Distant Scanned',
  'Camera Shake Enabled',
  'Camera Shake Time Period',
  'Camera Shake Frequency Noise Factor',
  'Camera Shake Translation Noise',
  'Camera Shake Rotation Noise',
  'Camera Shake Max Under Optimal Window',
  'Camera Shake In Optimal Window',
  'Camera Shake Min In Danger Window',
  'Camera Shake Change Lerp Speed',
  'Camera Shake Offset Position',
  'Camera Shake Offset Angle',
  'Block Throttle Change When Not Firing',
  'Throttle Reset On Stop Fire',
  'Throttle Change Per Action',
  'Throttle Acc Period',
  'Throttle Acc Factor',
  'Throttle Hold Acc Factor',
  'Throttle RTPC',
  'Power Capacity Per Mass',
  'Decay Per Mass',
  'Optimal Window Size',
  'Optimal Window Factor',
  'Resistance Curve Factor',
  'Optimal Window Thinness Curve Factor',
  'Optimal Window Max Size',
  'Controlled Breaking Fill Rate',
  'Controlled Breaking Fill Rate Danger',
  'Controlled Breaking Decay Rate',
  'Danger Breaking Fill Rate',
  'Danger Breaking Fill Rate Exponent',
  'Danger Breaking Decay Rate',
  'Absorbable Volume Threshold',
  'Child Rock Invulnerability Time',
  'CSCU Per Volume',
  'Default Mass',
  'Modifier Persistence Time',
  'Child Rock Life Timer',
  'Child Rock Zero G Damping',
  'Terrain Factor Static Threshold',
  'Show Explosion FX For Surplus Child',
  'Child Rock Inactivity Lifetime',
  'Gadget Detach Threshold',
  'Gadget Destroy Threshold',
  'Danger To Gadget Damage',
  'Waste Resource Type',
  'Instability Wave Period',
  'Instability Wave Variance',
  'Instability Curve Factor',
  'Danger Pool Factor',
  'Explosion Default Volume',
  'Hit History Window',
  'Standard Deviation Multiplier',
  'Time Exponent',
  'Min Deviation',
  'Extraction Magnitude',
  'Max Effect On Instability',
  'Fracture Particle Effect',
  'Explosion Particle Effect',
  'Center Rock Destroy Particle Effect',
  'Fully Extracted Rock Particle Effect',
  'Mineable Power Increasing Fall Off',
  'Mineable Power Level RTPC',
  'Mineable Danger Breaking RTPC',
  'Mineable Optimal Breaking RTPC',
  'Mineable Mass RTPC',
  'Mineable Crack Glow Strength RTPC',
  'Mining Start Trigger',
  'Mining Stop Trigger',
  'Good Fractured Trigger',
  'Bad Fractured Trigger',
  'Extracted Trigger',
  'Cluster Detection Radius',
  'Cluster Upper Object Count DGS',
  'Cluster Upper Object Count Persistence',
  'Cluster Persistence Timeout',
  'Reset Lifetime On Move',
  'Entity Idle Bury Only',
  'Record GUID',
  'Record Path',
];
const MINING_PROVIDER_PRESET_HEADERS = [
  'Provider Class',
  'System',
  'Location',
  'Group Name',
  'Group Probability',
  'Entry Index',
  'Harvestable GUID',
  'Harvestable Class',
  'Harvestable Path',
  'Harvestable Entity GUID',
  'Harvestable Entity Class',
  'Harvestable Entity Path',
  'Harvestable Setup GUID',
  'Harvestable Setup Class',
  'Composition GUID',
  'Composition Class',
  'Global Params GUID',
  'Audio Params GUID',
  'Filled Factor',
  'Clustering GUID',
  'Clustering Class',
  'Relative Probability',
  'Geometry Tags',
  'Record GUID',
  'Record Path',
];

export async function loadDataCoreTypeEntries(repoRoot: string): Promise<DataCoreTypeEntry[]> {
  const datacoreItemsDir = path.join(repoRoot, 'src', 'items', 'datacore');
  const entries = await fs.readdir(datacoreItemsDir);
  const result: DataCoreTypeEntry[] = [];

  for (const entry of entries) {
    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts') || entry === 'types.ts') continue;
    const slug = entry.replace(/\.ts$/, '');
    const fullPath = path.join(datacoreItemsDir, entry);
    const mod = await import(pathToFileURL(fullPath).href);
    if (!mod.DATACORE_TYPE_CONFIG) continue;
    const typeConfig: DataCoreItemTypeConfig = mod.DATACORE_TYPE_CONFIG;
    const csvFile: string = mod.default?.csvFile ?? `${slug}.datacore.csv`;
    result.push({ name: slug, csvFile, typeConfig });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export async function runDatacoreScrape(options: RunDatacoreScrapeOptions): Promise<RunDatacoreScrapeResult> {
  const loadTypes = options.loadTypes ?? loadDataCoreTypeEntries;
  const resolveLive = options.resolveLiveDir ?? resolveLiveDir;
  const readVersion = options.readGameVersion ?? readGameVersion;
  const ensureTools = options.ensureTools ?? ensureToolsInstalled;
  const extractPackedDcb = options.extractPackedDcb ?? extractPackedDataCoreDcb;
  const countXmlFiles = options.countXmlFiles ?? countDataCoreXmlFiles;
  const extractXmlCache = options.extractXmlCache ?? extractDataCoreXmlCache;
  const buildRecordGraph = options.buildRecordGraph ?? buildDataCoreRecordGraph;
  const writeRecordGraph = options.writeRecordGraph ?? writeDataCoreRecordGraph;
  const extractContractGenerators = options.extractContractGenerators ?? extractDataCoreContractGenerators;
  const extractContractTemplates = options.extractContractTemplates ?? extractDataCoreContractTemplates;
  const extractCommodities = options.extractCommodities ?? extractDataCoreCommodities;
  const extractVehicles = options.extractVehicles ?? extractDataCoreVehicles;
  const extractFactions = options.extractFactions ?? extractDataCoreFactions;
  const extractManufacturers = options.extractManufacturers ?? extractDataCoreManufacturers;
  const extractMissionBrokers = options.extractMissionBrokers ?? extractDataCoreMissionBrokers;
  const extractMissionLocalization = options.extractMissionLocalization ?? extractDataCoreMissionLocalization;
  const extractLocationLabels = options.extractLocationLabels ?? extractDataCoreLocationLabels;
  const extractMiningElements = options.extractMiningElements ?? extractDataCoreMiningElements;
  const extractMiningCompositions = options.extractMiningCompositions ?? extractDataCoreMiningCompositions;
  const extractMineableEntities = options.extractMineableEntities ?? extractDataCoreMineableEntities;
  const extractMiningDensityOverrides = options.extractMiningDensityOverrides ?? extractDataCoreMiningDensityOverrides;
  const extractMiningClustering = options.extractMiningClustering ?? extractDataCoreMiningClustering;
  const extractMiningHarvestablePresets =
    options.extractMiningHarvestablePresets ?? extractDataCoreMiningHarvestablePresets;
  const extractMiningHarvestableSetups =
    options.extractMiningHarvestableSetups ?? extractDataCoreMiningHarvestableSetups;
  const extractMiningSubHarvestableConfigs =
    options.extractMiningSubHarvestableConfigs ?? extractDataCoreMiningSubHarvestableConfigs;
  const extractMiningQualityDistributions =
    options.extractMiningQualityDistributions ?? extractDataCoreMiningQualityDistributions;
  const extractMiningQualityQuantizations =
    options.extractMiningQualityQuantizations ?? extractDataCoreMiningQualityQuantizations;
  const extractMiningRockSignatures = options.extractMiningRockSignatures ?? extractDataCoreMiningRockSignatures;
  const extractMiningLocationLabels = options.extractMiningLocationLabels ?? extractDataCoreMiningLocationLabels;
  const extractMiningParams = options.extractMiningParams ?? extractDataCoreMiningParams;
  const extractMiningProviderPresets = options.extractMiningProviderPresets ?? extractDataCoreMiningProviderPresets;
  const allTypes = await loadTypes(options.repoRoot);
  const selectedTypes = selectTypes(allTypes, options.types ?? []);
  const binDirname = options.binDirname ?? path.join(options.repoRoot, 'bin');
  const liveDir = resolveLive(binDirname);
  const gameVersion = await readVersion(liveDir);
  const channel = options.ptu ? 'ptu' : 'live';
  const versionTag = `${gameVersion}-${channel}`;
  const outputBase = path.join(options.repoRoot, 'csv', 'datacore', versionTag);
  const xmlCacheDir = path.join(options.repoRoot, 'csv', 'datacore', '.xmlcache', versionTag);
  const dcbCacheDir = path.join(options.repoRoot, 'csv', 'datacore', '.dcbcache', versionTag);
  const recordGraphPath = path.join(outputBase, 'record-graph.json');
  const fallbackDcbPath = options.findDcbFile ? await options.findDcbFile(liveDir) : undefined;
  const toolDir = path.join(liveDir, 'unp4k');

  if (!options.dryRun) {
    await fs.mkdir(outputBase, { recursive: true });
  }

  const tools = await ensureTools(toolDir, (message) => options.onToolsLog?.(message));
  options.onToolsReady?.(tools);
  const { dcbPath, refreshed: dcbRefreshed } = await resolveCurrentDcbFile({
    liveDir,
    dcbCacheDir,
    tools,
    extractPackedDcb,
    forceExtract: options.forceExtract,
    fallbackDcbPath,
  });

  options.onPrepared?.({
    gameVersion,
    channel,
    dcbPath,
    outputBase,
    xmlCacheDir,
    selectedTypes,
    allTypes,
    dryRun: Boolean(options.dryRun),
  });

  const cachedCount = await countXmlFiles(xmlCacheDir);

  if (cachedCount > 0 && !options.forceExtract && !dcbRefreshed) {
    options.onCacheHit?.(cachedCount, xmlCacheDir);
  } else {
    const clearExisting = cachedCount > 0 && Boolean(options.forceExtract || dcbRefreshed);
    options.onCacheExtractStart?.(dcbPath, xmlCacheDir, clearExisting);
    const { xmlFileCount } = await extractXmlCache({
      dcbPath,
      xmlCacheDir,
      clearExisting,
      runUnforge: (cacheDir) => runTool(tools.unforge, [cacheDir]),
    });
    options.onCacheExtractComplete?.(xmlFileCount);
  }

  const recordGraph = await buildRecordGraph({ xmlCacheDir });
  if (!options.dryRun) {
    await writeRecordGraph(recordGraph, recordGraphPath);
  }
  options.onRecordGraphBuilt?.(recordGraph.recordCount, recordGraphPath, Boolean(options.dryRun));
  const graphLookup = createDataCoreRecordGraphLookup(recordGraph);

  const contractGeneratorRows = await extractContractGenerators({ xmlCacheDir, graph: graphLookup });
  const contractGeneratorResult = await writeContractGeneratorCsv(contractGeneratorRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onContractGeneratorsExtracted?.(
    contractGeneratorResult.rows,
    contractGeneratorResult.csvFile,
    Boolean(options.dryRun),
  );

  const contractTemplateRows = await extractContractTemplates({ xmlCacheDir, graph: graphLookup });
  const contractTemplateResult = await writeContractTemplateCsv(contractTemplateRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onContractTemplatesExtracted?.(
    contractTemplateResult.rows,
    contractTemplateResult.csvFile,
    Boolean(options.dryRun),
  );

  const missionBrokerRows = await extractMissionBrokers({ xmlCacheDir, graph: graphLookup });
  const missionBrokerResult = await writeMissionBrokerCsv(missionBrokerRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onMissionBrokersExtracted?.(missionBrokerResult.rows, missionBrokerResult.csvFile, Boolean(options.dryRun));

  const missionLocalizationRows = extractMissionLocalization(recordGraph);
  const missionLocalizationResult = await writeMissionLocalizationCsv(missionLocalizationRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onMissionLocalizationExtracted?.(
    missionLocalizationResult.rows,
    missionLocalizationResult.csvFile,
    Boolean(options.dryRun),
  );
  const manufacturerResolver = createDataCoreManufacturerResolver(graphLookup);

  const commodityRows = await extractCommodities({
    xmlCacheDir,
    graph: graphLookup,
  });
  const commodityResult = await writeCommodityCsv(commodityRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onCommoditiesExtracted?.(commodityResult.rows, commodityResult.csvFile, Boolean(options.dryRun));

  const vehicleRows = await extractVehicles({
    xmlCacheDir,
    graph: graphLookup,
  });
  const vehicleResult = await writeVehicleCsv(vehicleRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onVehiclesExtracted?.(vehicleResult.rows, vehicleResult.csvFile, Boolean(options.dryRun));

  const factionRows = await extractFactions({
    xmlCacheDir,
    graph: graphLookup,
  });
  const factionResult = await writeFactionCsv(factionRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onFactionsExtracted?.(factionResult.rows, factionResult.csvFile, Boolean(options.dryRun));

  const manufacturerRows = await extractManufacturers({
    xmlCacheDir,
    graph: graphLookup,
  });
  const manufacturerResult = await writeManufacturerCsv(manufacturerRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onManufacturersExtracted?.(manufacturerResult.rows, manufacturerResult.csvFile, Boolean(options.dryRun));

  const locationLabelRows = await extractLocationLabels({
    xmlCacheDir,
    graph: graphLookup,
  });
  const locationLabelResult = await writeLocationLabelCsv(locationLabelRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onLocationLabelsExtracted?.(locationLabelResult.rows, locationLabelResult.csvFile, Boolean(options.dryRun));

  const miningElementRows = await extractMiningElements({
    xmlCacheDir,
    graph: graphLookup,
  });
  const miningElementResult = await writeMiningElementCsv(miningElementRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onMiningElementsExtracted?.(miningElementResult.rows, miningElementResult.csvFile, Boolean(options.dryRun));

  const miningCompositionRows = await extractMiningCompositions({
    xmlCacheDir,
    graph: graphLookup,
  });
  const miningCompositionResult = await writeMiningCompositionCsv(miningCompositionRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onMiningCompositionsExtracted?.(
    miningCompositionResult.rows,
    miningCompositionResult.csvFile,
    Boolean(options.dryRun),
  );

  const mineableEntityRows = await extractMineableEntities({
    xmlCacheDir,
    graph: graphLookup,
  });
  const mineableEntityResult = await writeMineableEntityCsv(mineableEntityRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onMineableEntitiesExtracted?.(
    mineableEntityResult.rows,
    mineableEntityResult.csvFile,
    Boolean(options.dryRun),
  );

  const miningDensityOverrideRows = await extractMiningDensityOverrides({
    xmlCacheDir,
    graph: graphLookup,
  });
  const miningDensityOverrideResult = await writeMiningDensityOverrideCsv(miningDensityOverrideRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onMiningDensityOverridesExtracted?.(
    miningDensityOverrideResult.rows,
    miningDensityOverrideResult.csvFile,
    Boolean(options.dryRun),
  );

  const miningClusteringRows = await extractMiningClustering({
    xmlCacheDir,
    graph: graphLookup,
  });
  const miningClusteringResult = await writeMiningClusteringCsv(miningClusteringRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onMiningClusteringExtracted?.(
    miningClusteringResult.rows,
    miningClusteringResult.csvFile,
    Boolean(options.dryRun),
  );

  const miningHarvestablePresetRows = await extractMiningHarvestablePresets({
    xmlCacheDir,
    graph: graphLookup,
  });
  const miningHarvestablePresetResult = await writeMiningHarvestablePresetCsv(miningHarvestablePresetRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onMiningHarvestablePresetsExtracted?.(
    miningHarvestablePresetResult.rows,
    miningHarvestablePresetResult.csvFile,
    Boolean(options.dryRun),
  );

  const miningHarvestableSetupRows = await extractMiningHarvestableSetups({
    xmlCacheDir,
    graph: graphLookup,
  });
  const miningHarvestableSetupResult = await writeMiningHarvestableSetupCsv(miningHarvestableSetupRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onMiningHarvestableSetupsExtracted?.(
    miningHarvestableSetupResult.rows,
    miningHarvestableSetupResult.csvFile,
    Boolean(options.dryRun),
  );

  const miningSubHarvestableConfigRows = await extractMiningSubHarvestableConfigs({
    xmlCacheDir,
    graph: graphLookup,
  });
  const miningSubHarvestableConfigResult = await writeMiningSubHarvestableConfigCsv(miningSubHarvestableConfigRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onMiningSubHarvestableConfigsExtracted?.(
    miningSubHarvestableConfigResult.rows,
    miningSubHarvestableConfigResult.csvFile,
    Boolean(options.dryRun),
  );

  const miningQualityDistributionRows = await extractMiningQualityDistributions({
    xmlCacheDir,
    graph: graphLookup,
  });
  const miningQualityDistributionResult = await writeMiningQualityDistributionCsv(miningQualityDistributionRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onMiningQualityDistributionsExtracted?.(
    miningQualityDistributionResult.rows,
    miningQualityDistributionResult.csvFile,
    Boolean(options.dryRun),
  );

  const miningQualityQuantizationRows = await extractMiningQualityQuantizations({
    xmlCacheDir,
    graph: graphLookup,
  });
  const miningQualityQuantizationResult = await writeMiningQualityQuantizationCsv(miningQualityQuantizationRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onMiningQualityQuantizationsExtracted?.(
    miningQualityQuantizationResult.rows,
    miningQualityQuantizationResult.csvFile,
    Boolean(options.dryRun),
  );

  const miningRockSignatureRows = await extractMiningRockSignatures({
    xmlCacheDir,
    graph: graphLookup,
  });
  const miningRockSignatureResult = await writeMiningRockSignatureCsv(miningRockSignatureRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onMiningRockSignaturesExtracted?.(
    miningRockSignatureResult.rows,
    miningRockSignatureResult.csvFile,
    Boolean(options.dryRun),
  );

  const miningLocationLabelRows = await extractMiningLocationLabels({
    xmlCacheDir,
    graph: graphLookup,
  });
  const miningLocationLabelResult = await writeMiningLocationLabelCsv(miningLocationLabelRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onMiningLocationLabelsExtracted?.(
    miningLocationLabelResult.rows,
    miningLocationLabelResult.csvFile,
    Boolean(options.dryRun),
  );

  const miningParamRows = await extractMiningParams({
    xmlCacheDir,
    graph: graphLookup,
  });
  const miningParamResult = await writeMiningParamCsv(miningParamRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onMiningParamsExtracted?.(miningParamResult.rows, miningParamResult.csvFile, Boolean(options.dryRun));

  const miningProviderPresetRows = await extractMiningProviderPresets({
    xmlCacheDir,
    graph: graphLookup,
  });
  const miningProviderPresetResult = await writeMiningProviderPresetCsv(miningProviderPresetRows, {
    outputBase,
    dryRun: options.dryRun,
  });
  options.onMiningProviderPresetsExtracted?.(
    miningProviderPresetResult.rows,
    miningProviderPresetResult.csvFile,
    Boolean(options.dryRun),
  );

  const results: DataCoreScrapeTypeResult[] = [];
  const errors: DataCoreScrapeTypeError[] = [];

  for (let index = 0; index < selectedTypes.length; index++) {
    const entry = selectedTypes[index];
    options.onTypeStart?.(entry, index);

    try {
      results.push(
        await scrapeDataCoreType(entry, {
          xmlCacheDir,
          outputBase,
          dryRun: options.dryRun,
          manufacturerResolver,
          graph: graphLookup,
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ type: entry.name, message });
    }
  }

  const rawFactResults = buildRawFactResults(
    new Map([
      [contractGeneratorResult.csvFile, contractGeneratorResult],
      [contractTemplateResult.csvFile, contractTemplateResult],
      [commodityResult.csvFile, commodityResult],
      [vehicleResult.csvFile, vehicleResult],
      [factionResult.csvFile, factionResult],
      [manufacturerResult.csvFile, manufacturerResult],
      [locationLabelResult.csvFile, locationLabelResult],
      [missionBrokerResult.csvFile, missionBrokerResult],
      [missionLocalizationResult.csvFile, missionLocalizationResult],
      [miningLocationLabelResult.csvFile, miningLocationLabelResult],
    ]),
  );

  return {
    exitCode: errors.length > 0 ? 1 : 0,
    gameVersion,
    channel,
    versionTag,
    dcbPath,
    outputBase,
    xmlCacheDir,
    allTypes,
    selectedTypes,
    recordGraph: {
      recordCount: recordGraph.recordCount,
      outputPath: recordGraphPath,
    },
    contractGeneratorResult,
    contractTemplateResult,
    commodityResult,
    vehicleResult,
    factionResult,
    manufacturerResult,
    locationLabelResult,
    missionBrokerResult,
    missionLocalizationResult,
    miningElementResult,
    miningCompositionResult,
    mineableEntityResult,
    miningDensityOverrideResult,
    miningClusteringResult,
    miningHarvestablePresetResult,
    miningHarvestableSetupResult,
    miningSubHarvestableConfigResult,
    miningQualityDistributionResult,
    miningQualityQuantizationResult,
    miningRockSignatureResult,
    miningLocationLabelResult,
    miningParamResult,
    miningProviderPresetResult,
    rawFactResults,
    results,
    errors,
  };
}

function selectTypes(allTypes: DataCoreTypeEntry[], requestedNames: string[]): DataCoreTypeEntry[] {
  if (requestedNames.length === 0) return allTypes;

  return requestedNames.map((name) => {
    const found = allTypes.find((entry) => entry.name === name);
    if (!found) throw new Error(`Unknown item type: "${name}". Run with --list to see valid types.`);
    return found;
  });
}

async function fileMtimeMs(filePath: string): Promise<number | null> {
  try {
    return (await fs.stat(filePath)).mtimeMs;
  } catch {
    return null;
  }
}

async function resolveCurrentDcbFile(options: {
  liveDir: string;
  dcbCacheDir: string;
  tools: Unp4kTools;
  extractPackedDcb: (p4kPath: string, dcbCacheDir: string, tools: Unp4kTools) => void | Promise<void>;
  forceExtract?: boolean;
  fallbackDcbPath?: string;
}): Promise<{ dcbPath: string; refreshed: boolean }> {
  const p4kPath = path.join(options.liveDir, 'Data.p4k');
  const p4kMtime = await fileMtimeMs(p4kPath);

  if (!p4kMtime) {
    if (options.fallbackDcbPath) return { dcbPath: options.fallbackDcbPath, refreshed: false };
    throw new Error(`Data.p4k not found at ${p4kPath}. Set SC_LIVE_DIR to a valid game install.`);
  }

  const packedDcbPath = path.join(options.dcbCacheDir, 'Data', 'Game2.dcb');
  const packedDcbMtime = await fileMtimeMs(packedDcbPath);
  let refreshed = false;
  if (options.forceExtract || !packedDcbMtime || packedDcbMtime < p4kMtime) {
    await fs.rm(options.dcbCacheDir, { recursive: true, force: true });
    await fs.mkdir(options.dcbCacheDir, { recursive: true });
    await options.extractPackedDcb(p4kPath, options.dcbCacheDir, options.tools);
    refreshed = true;
  }

  return { dcbPath: packedDcbPath, refreshed };
}

function extractPackedDataCoreDcb(p4kPath: string, dcbCacheDir: string, tools: Unp4kTools): void {
  runTool(tools.unp4k, [p4kPath, 'Game2.dcb'], { cwd: dcbCacheDir });
}

async function scrapeDataCoreType(
  entry: DataCoreTypeEntry,
  options: {
    xmlCacheDir: string;
    outputBase: string;
    dryRun?: boolean;
    manufacturerResolver?: DataCoreManufacturerResolver;
    graph?: DataCoreRecordGraphLookup;
  },
): Promise<DataCoreScrapeTypeResult> {
  const { name, csvFile, typeConfig } = entry;
  const recordFilters = Array.isArray(typeConfig.recordFilter) ? typeConfig.recordFilter : [typeConfig.recordFilter];
  const xmlFileSet = new Set<string>();
  for (const recordFilter of recordFilters) {
    for (const xmlFile of await collectDataCoreXmlFilesMatching(options.xmlCacheDir, recordFilter)) {
      xmlFileSet.add(xmlFile);
    }
  }
  const xmlFiles = [...xmlFileSet].sort();
  const typeHeaders = Object.keys(typeConfig.fieldSelectors);
  const headers = [...COMMON_HEADERS, ...typeHeaders];
  const rows: string[][] = [];
  const referencedXmlCache = new Map<string, ReturnType<typeof loadXml>>();
  let skipped = 0;

  for (const xmlPath of xmlFiles) {
    const xml = await fs.readFile(xmlPath, 'utf8');
    let $: ReturnType<typeof loadXml>;
    try {
      $ = loadXml(xml);
    } catch {
      skipped++;
      continue;
    }

    if (typeConfig.recordSelector && $(typeConfig.recordSelector).length === 0) {
      skipped++;
      continue;
    }

    let entityClass = extractEntityClass($);
    if (!entityClass) {
      entityClass = path.basename(xmlPath, path.extname(xmlPath));
    }

    if (!entityClass || entityClass.startsWith('__')) {
      skipped++;
      continue;
    }

    const attachDef = extractAttachDef($);
    const health = extractHealth($);
    const attachLocalization = $('SAttachableComponentParams AttachDef > Localization').first();
    const manufacturer = resolveManufacturerCode(attachDef.manufacturer, options.manufacturerResolver);
    const rowRecord: Record<string, string> = {
      'Entity Class': entityClass,
      'Name Key': localizationKey(attachLocalization.attr('Name') ?? ''),
      'Short Name Key': localizationKey(attachLocalization.attr('ShortName') ?? ''),
      'Description Key': localizationKey(attachLocalization.attr('Description') ?? ''),
      Manufacturer: manufacturer,
      Size: attachDef.size,
      Grade: attachDef.grade,
      Class: attachDef.subtype,
      Health: health,
    };

    const typeFields: string[] = [];
    for (const col of typeHeaders) {
      const spec = typeConfig.fieldSelectors[col];
      if (!spec) {
        rowRecord[col] = '';
        typeFields.push('');
        continue;
      }
      const value = await resolveField($, spec, rowRecord, {
        graph: options.graph,
        xmlCacheDir: options.xmlCacheDir,
        referencedXmlCache,
      });
      rowRecord[col] = value;
      typeFields.push(value);
    }

    rows.push([
      entityClass,
      rowRecord['Name Key'],
      rowRecord['Short Name Key'],
      rowRecord['Description Key'],
      manufacturer,
      attachDef.size,
      attachDef.grade,
      attachDef.subtype,
      health,
      ...typeFields,
    ]);
  }

  if (!options.dryRun && rows.length > 0) {
    const csvContent = stringify([headers, ...rows]);
    await fs.writeFile(path.join(options.outputBase, csvFile), csvContent, 'utf8');
  }

  return { type: name, rows: rows.length, skipped, csvFile };
}

async function writeContractGeneratorCsv(
  rows: DataCoreContractGeneratorRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeContractGeneratorResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.generatorClass,
      row.handlerType,
      row.handlerDebugName,
      row.handlerNotForRelease,
      row.handlerWorkInProgress,
      row.factionReputationGuid,
      row.reputationScopeGuid,
      row.contractSection,
      row.contractId,
      row.contractDebugName,
      row.contractNotForRelease,
      row.contractWorkInProgress,
      row.templateGuid,
      row.templateClass,
      row.titleKey,
      row.descriptionKey,
      row.contractorKey,
      row.titleVariantKeys,
      row.descriptionVariantKeys,
      row.stringParamOverrides,
      row.locationTagGuids,
      row.locationTagClasses,
      row.maxInstances,
      row.maxInstancesPerPlayer,
      row.respawnTime,
      row.respawnTimeVariation,
      row.instanceLifeTime,
      row.instanceLifeTimeVariation,
      row.contractBuyInAmount,
      row.timeToComplete,
      row.difficultyProfileGuid,
      row.difficultyProfileClass,
      row.mechanicalSkill,
      row.mentalLoad,
      row.riskOfLoss,
      row.gameKnowledge,
      row.recordGuid,
      row.recordPath,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, CONTRACT_GENERATORS_CSV_FILE),
      stringify([CONTRACT_GENERATOR_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: CONTRACT_GENERATORS_CSV_FILE };
}

async function writeContractTemplateCsv(
  rows: DataCoreContractTemplateRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeContractTemplateResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.templateClass,
      row.contractClassType,
      row.ownerGuid,
      row.ownerClass,
      row.displayTypeGuid,
      row.displayTypeClass,
      row.illegal,
      row.showLifeTimeInMobiGlas,
      row.preShowObjectives,
      row.hasCompleteButton,
      row.handlesAbandonRequest,
      row.canBeShared,
      row.displayAlliedMarkers,
      row.onlyOwnerCanComplete,
      row.failIfSentToPrison,
      row.failIfBecameCriminal,
      row.failIfLeavePrison,
      row.missionCompletionTime,
      row.missionAutoEnd,
      row.missionResultAfterTimerEnd,
      row.remainingTimeToShowTimer,
      row.objectiveCount,
      row.missionPropertyCount,
      row.objectiveHandlerTypes,
      row.objectiveHandlerModules,
      row.objectiveDisplayKeys,
      row.travelObjectiveKeys,
      row.returnObjectiveKeys,
      row.overrideMissionDetailsKeys,
      row.navPointNameKeys,
      row.stringHashKeys,
      row.locationTagGuids,
      row.locationTagClasses,
      row.recordGuid,
      row.recordPath,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, CONTRACT_TEMPLATES_CSV_FILE),
      stringify([CONTRACT_TEMPLATE_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: CONTRACT_TEMPLATES_CSV_FILE };
}

async function writeCommodityCsv(
  rows: DataCoreCommodityRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeCommodityResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.entityClass,
      row.nameKey,
      row.descriptionKey,
      row.displayNameKey,
      row.displayDescriptionKey,
      row.displayTypeKey,
      row.typeGuid,
      row.subtypeGuid,
      row.cargoOccupancyUnit,
      row.cargoOccupancyValue,
      row.cargoOccupancySCU,
      row.boxable,
      row.isUnrefinedElement,
      row.isRaw,
      row.isRefined,
      row.ref,
      row.path,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, COMMODITY_CSV_FILE),
      stringify([COMMODITY_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: COMMODITY_CSV_FILE };
}

async function writeVehicleCsv(
  rows: DataCoreVehicleRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeVehicleResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.entityClass,
      row.vehicleNameKey,
      row.vehicleDescriptionKey,
      row.manufacturerGuid,
      row.manufacturerCode,
      row.manufacturerNameKey,
      row.movementClass,
      row.vehicleDefinition,
      row.modification,
      row.careerKey,
      row.careerGuid,
      row.roleKey,
      row.roleGuid,
      row.crewSize,
      row.hullDamageNormalization,
      row.allowSoftDestruction,
      row.dogfightEnabled,
      row.isGravlevVehicle,
      row.inventoryContainerGuid,
      row.ref,
      row.path,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, VEHICLES_CSV_FILE),
      stringify([VEHICLE_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: VEHICLES_CSV_FILE };
}

async function writeFactionCsv(
  rows: DataCoreFactionRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeFactionResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.factionClass,
      row.nameKey,
      row.descriptionKey,
      row.defaultReaction,
      row.factionType,
      row.ableToArrest,
      row.policesLawfulTrespass,
      row.policesCriminality,
      row.noLegalRights,
      row.factionReputationGuid,
      row.factionReputationClass,
      row.factionReputationPath,
      row.reputationDisplayNameKey,
      row.reputationDescriptionKey,
      row.reputationHeadquartersKey,
      row.reputationFoundedKey,
      row.reputationLeadershipKey,
      row.reputationAreaKey,
      row.reputationFocusKey,
      row.reputationLawful,
      row.alliedFactionGuids,
      row.enemyFactionGuids,
      row.ref,
      row.path,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, FACTIONS_CSV_FILE),
      stringify([FACTION_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: FACTIONS_CSV_FILE };
}

async function writeManufacturerCsv(
  rows: DataCoreManufacturerRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeManufacturerResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.manufacturerClass,
      row.code,
      row.nameKey,
      row.shortNameKey,
      row.descriptionKey,
      row.logo,
      row.logoFullColor,
      row.logoSimplifiedWhite,
      row.dashboardCanvasConfigGuid,
      row.buildingBlocksStyleGuid,
      row.audioManufacturerTagGuid,
      row.lightAmplificationGuid,
      row.ref,
      row.path,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, MANUFACTURERS_CSV_FILE),
      stringify([MANUFACTURER_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: MANUFACTURERS_CSV_FILE };
}

async function writeLocationLabelCsv(
  rows: DataCoreLocationLabelRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeLocationLabelResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.locationClass,
      row.nameKey,
      row.descriptionKey,
      row.callout1Key,
      row.callout2Key,
      row.callout3Key,
      row.typeGuid,
      row.parentGuid,
      row.parentClass,
      row.parentPath,
      row.affiliationGuid,
      row.affiliationClass,
      row.affiliationPath,
      row.affiliationNameKey,
      row.jurisdictionGuid,
      row.jurisdictionClass,
      row.jurisdictionPath,
      row.jurisdictionNameKey,
      row.respawnLocationType,
      row.locationHierarchyTag,
      row.navIcon,
      row.size,
      row.hideInStarmap,
      row.hideInWorld,
      row.hideWhenInAdoptionRadius,
      row.onlyShowWhenParentSelected,
      row.overrideShowInAllZones,
      row.overridePermanent,
      row.minimumDisplaySize,
      row.blockTravel,
      row.isScannable,
      row.showOrbitLine,
      row.useHoloMaterial,
      row.noAutoBodyRecovery,
      row.arrivalRadius,
      row.adoptionRadius,
      row.setEntityLocationOnEnter,
      row.exposeForPlayerCreatedMissions,
      row.starMapGeomPath,
      row.starMapMaterialPath,
      row.starMapShapePath,
      row.locationImagePath,
      row.ref,
      row.path,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, LOCATION_LABELS_CSV_FILE),
      stringify([LOCATION_LABEL_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: LOCATION_LABELS_CSV_FILE };
}

async function writeMissionLocalizationCsv(
  rows: DataCoreMissionLocalizationRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeMissionLocalizationResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.localizationKey,
      row.localizationRole,
      row.attribute,
      row.rootType,
      row.entityClass,
      row.ref,
      row.path,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, MISSION_LOCALIZATION_CSV_FILE),
      stringify([MISSION_LOCALIZATION_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: MISSION_LOCALIZATION_CSV_FILE };
}

async function writeMissionBrokerCsv(
  rows: DataCoreMissionBrokerRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeMissionBrokerResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.missionClass,
      row.titleKey,
      row.titleHudKey,
      row.descriptionKey,
      row.missionGiverKey,
      row.commsChannelNameKey,
      row.missionModule,
      row.missionTypeGuid,
      row.missionTypeClass,
      row.ownerGuid,
      row.ownerClass,
      row.missionGiverRecordGuid,
      row.missionGiverRecordClass,
      row.locationMissionAvailableGuid,
      row.locationMissionAvailableClass,
      row.missionDifficulty,
      row.reward,
      row.rewardMax,
      row.rewardPlusBonuses,
      row.currencyType,
      row.missionCompletionTime,
      row.missionAutoEnd,
      row.missionResultAfterTimerEnd,
      row.remainingTimeToShowTimer,
      row.initiallyActive,
      row.notifyOnAvailable,
      row.showAsOffer,
      row.requestOnly,
      row.lawfulMission,
      row.maxInstances,
      row.maxPlayersPerInstance,
      row.maxInstancesPerPlayer,
      row.canBeShared,
      row.onceOnly,
      row.tutorial,
      row.availableInPrison,
      row.failIfSentToPrison,
      row.failIfBecameCriminal,
      row.failIfLeavePrison,
      row.respawnTime,
      row.respawnTimeVariation,
      row.instanceHasLifeTime,
      row.showLifeTimeInMobiGlas,
      row.instanceLifeTime,
      row.instanceLifeTimeVariation,
      row.canReacceptAfterAbandoning,
      row.abandonedCooldownTime,
      row.abandonedCooldownTimeVariation,
      row.canReacceptAfterFailing,
      row.hasPersonalCooldown,
      row.personalCooldownTime,
      row.personalCooldownTimeVariation,
      row.recordGuid,
      row.recordPath,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, MISSION_BROKERS_CSV_FILE),
      stringify([MISSION_BROKER_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: MISSION_BROKERS_CSV_FILE };
}

async function writeMiningElementCsv(
  rows: DataCoreMiningElementRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeMiningElementResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.elementClass,
      row.elementName,
      row.materialName,
      row.inferredDescriptionKey,
      row.resourceTypeGuid,
      row.instability,
      row.resistance,
      row.optimalWindowMidpoint,
      row.optimalWindowRandomness,
      row.optimalWindowThinness,
      row.explosionMultiplier,
      row.clusterFactor,
      row.ref,
      row.path,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, MINING_ELEMENTS_CSV_FILE),
      stringify([MINING_ELEMENT_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: MINING_ELEMENTS_CSV_FILE };
}

async function writeMiningCompositionCsv(
  rows: DataCoreMiningCompositionPartRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeMiningCompositionResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.compositionClass,
      row.depositNameKey,
      row.minimumDistinctElements,
      row.partIndex,
      row.mineableElementGuid,
      row.mineableElementClass,
      row.mineableElementName,
      row.minPercentage,
      row.maxPercentage,
      row.probability,
      row.curveExponent,
      row.qualityScale,
      row.ref,
      row.path,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, MINING_COMPOSITIONS_CSV_FILE),
      stringify([MINING_COMPOSITION_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: MINING_COMPOSITIONS_CSV_FILE };
}

async function writeMineableEntityCsv(
  rows: DataCoreMineableEntityRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeMineableEntityResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.entityClass,
      row.compositionGuid,
      row.compositionClass,
      row.globalParamsGuid,
      row.globalParamsClass,
      row.audioParamsGuid,
      row.audioParamsClass,
      row.densityClassGuid,
      row.densityClass,
      row.filledFactor,
      row.glowCurvePower,
      row.glowLerpSpeed,
      row.allowAutoRespawning,
      row.ref,
      row.path,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, MINEABLE_ENTITIES_CSV_FILE),
      stringify([MINEABLE_ENTITY_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: MINEABLE_ENTITIES_CSV_FILE };
}

async function writeMiningDensityOverrideCsv(
  rows: DataCoreMiningDensityOverrideRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeMiningDensityOverrideResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.overrideClass,
      row.densityClassGuid,
      row.densityClass,
      row.densityClassPath,
      row.lifetimeDays,
      row.lifetimeHours,
      row.lifetimeMinutes,
      row.lifetimeSeconds,
      row.lifetimeTotalSeconds,
      row.ref,
      row.path,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, MINING_DENSITY_OVERRIDES_CSV_FILE),
      stringify([MINING_DENSITY_OVERRIDE_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: MINING_DENSITY_OVERRIDES_CSV_FILE };
}

async function writeMiningClusteringCsv(
  rows: DataCoreMiningClusteringParamRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeMiningClusteringResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.clusteringClass,
      row.probabilityOfClustering,
      row.paramIndex,
      row.relativeProbability,
      row.minSize,
      row.maxSize,
      row.minProximity,
      row.maxProximity,
      row.ref,
      row.path,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, MINING_CLUSTERING_CSV_FILE),
      stringify([MINING_CLUSTERING_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: MINING_CLUSTERING_CSV_FILE };
}

async function writeMiningHarvestablePresetCsv(
  rows: DataCoreMiningHarvestablePresetRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeMiningHarvestablePresetResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.harvestablePresetClass,
      row.harvestableEntityGuid,
      row.harvestableEntityClass,
      row.harvestableEntityPath,
      row.respawnInSlotTime,
      row.specialHarvestableString,
      row.ref,
      row.path,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, MINING_HARVESTABLE_PRESETS_CSV_FILE),
      stringify([MINING_HARVESTABLE_PRESET_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: MINING_HARVESTABLE_PRESETS_CSV_FILE };
}

async function writeMiningHarvestableSetupCsv(
  rows: DataCoreMiningHarvestableSetupRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeMiningHarvestableSetupResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.setupClass,
      row.respawnInSlotTime,
      row.specialHarvestableString,
      row.harvestConditionTypes,
      row.healthRatio,
      row.includeAttachedChildren,
      row.allInteractionsClearSpawnPoint,
      row.movementDistance,
      row.despawnTimeSeconds,
      row.additionalWaitForNearbyPlayersSeconds,
      row.minScale,
      row.maxScale,
      row.terrainNormalAlignment,
      row.minZOffset,
      row.maxZOffset,
      row.minSlope,
      row.maxSlope,
      row.minElevation,
      row.maxElevation,
      row.localRotationOffset,
      row.rotationRange,
      row.positionOffset,
      row.ref,
      row.path,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, MINING_HARVESTABLE_SETUPS_CSV_FILE),
      stringify([MINING_HARVESTABLE_SETUP_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: MINING_HARVESTABLE_SETUPS_CSV_FILE };
}

async function writeMiningSubHarvestableConfigCsv(
  rows: DataCoreMiningSubHarvestableConfigRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeMiningSubHarvestableConfigResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.configClass,
      row.configType,
      row.taggedConfigName,
      row.tagGuids,
      row.initialSlotsProbability,
      row.configRespawnTimeMultiplier,
      row.slotIndex,
      row.harvestableGuid,
      row.harvestableClass,
      row.harvestablePath,
      row.harvestableEntityGuid,
      row.harvestableEntityClass,
      row.harvestableEntityPath,
      row.harvestableSetupGuid,
      row.harvestableSetupClass,
      row.relativeProbability,
      row.deepestRelativeProbability,
      row.harvestableRespawnTimeMultiplier,
      row.geometryTags,
      row.referencedConfigGuid,
      row.referencedConfigClass,
      row.referencedConfigPath,
      row.ref,
      row.path,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, MINING_SUB_HARVESTABLE_CONFIGS_CSV_FILE),
      stringify([MINING_SUB_HARVESTABLE_CONFIG_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: MINING_SUB_HARVESTABLE_CONFIGS_CSV_FILE };
}

async function writeMiningQualityDistributionCsv(
  rows: DataCoreMiningQualityDistributionRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeMiningQualityDistributionResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.distributionClass,
      row.distributionType,
      row.mineableFamily,
      row.locationGuid,
      row.locationClass,
      row.locationPath,
      row.minQuality,
      row.maxQuality,
      row.mean,
      row.stddev,
      row.ref,
      row.path,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, MINING_QUALITY_DISTRIBUTIONS_CSV_FILE),
      stringify([MINING_QUALITY_DISTRIBUTION_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: MINING_QUALITY_DISTRIBUTIONS_CSV_FILE };
}

async function writeMiningRockSignatureCsv(
  rows: DataCoreMiningRockSignatureRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeMiningRockSignatureResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.entityClass,
      row.variantFamily,
      row.rarity,
      row.elementToken,
      row.scanSignature,
      row.ref,
      row.path,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, MINING_ROCK_SIGNATURES_CSV_FILE),
      stringify([MINING_ROCK_SIGNATURE_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: MINING_ROCK_SIGNATURES_CSV_FILE };
}

async function writeMiningQualityQuantizationCsv(
  rows: DataCoreMiningQualityQuantizationRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeMiningQualityQuantizationResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.quantizationClass,
      row.elementToken,
      row.qualityBands,
      row.bandRanges,
      row.ref,
      row.path,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, MINING_QUALITY_QUANTIZATIONS_CSV_FILE),
      stringify([MINING_QUALITY_QUANTIZATION_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: MINING_QUALITY_QUANTIZATIONS_CSV_FILE };
}

async function writeMiningLocationLabelCsv(
  rows: DataCoreMiningLocationLabelRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeMiningLocationLabelResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.locationClass,
      row.sourceReason,
      row.nameKey,
      row.descriptionKey,
      row.callout1Key,
      row.callout2Key,
      row.callout3Key,
      row.typeGuid,
      row.parentGuid,
      row.parentClass,
      row.parentPath,
      row.locationHierarchyTag,
      row.navIcon,
      row.size,
      row.hideInStarmap,
      row.hideInWorld,
      row.isScannable,
      row.blockTravel,
      row.arrivalRadius,
      row.adoptionRadius,
      row.setEntityLocationOnEnter,
      row.exposeForPlayerCreatedMissions,
      row.ref,
      row.path,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, MINING_LOCATION_LABELS_CSV_FILE),
      stringify([MINING_LOCATION_LABEL_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: MINING_LOCATION_LABELS_CSV_FILE };
}

async function writeMiningParamCsv(
  rows: DataCoreMiningParamRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeMiningParamResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.paramType,
      row.paramClass,
      row.highlightOccludedAlpha,
      row.highlightOutlineWidth,
      row.highlightDistantMineablesRange,
      row.showChildRockRadarIcon,
      row.scalePowerGraphMin,
      row.noProgressHintTime,
      row.noProgressHintPower,
      row.fractureDoneFeedbackDuration,
      row.maxScanRaycastDistance,
      row.highlightColor,
      row.highlightColorAbsorbable,
      row.highlightColorDistant,
      row.highlightColorDistantScanned,
      row.cameraShakeEnabled,
      row.cameraShakeTimePeriod,
      row.cameraShakeFrequencyNoiseFactor,
      row.cameraShakeTranslationNoise,
      row.cameraShakeRotationNoise,
      row.cameraShakeMaxUnderOptimalWindow,
      row.cameraShakeInOptimalWindow,
      row.cameraShakeMinInDangerWindow,
      row.cameraShakeChangeLerpSpeed,
      row.cameraShakeOffsetPosition,
      row.cameraShakeOffsetAngle,
      row.blockThrottleChangeWhenNotFiring,
      row.throttleResetOnStopFire,
      row.throttleChangePerAction,
      row.throttleAccPeriod,
      row.throttleAccFactor,
      row.throttleHoldAccFactor,
      row.throttleRtpc,
      row.powerCapacityPerMass,
      row.decayPerMass,
      row.optimalWindowSize,
      row.optimalWindowFactor,
      row.resistanceCurveFactor,
      row.optimalWindowThinnessCurveFactor,
      row.optimalWindowMaxSize,
      row.controlledBreakingFillRate,
      row.controlledBreakingFillRateDanger,
      row.controlledBreakingDecayRate,
      row.dangerBreakingFillRate,
      row.dangerBreakingFillRateExponent,
      row.dangerBreakingDecayRate,
      row.absorbableVolumeThreshold,
      row.childRockInvulnerabilityTime,
      row.cSCUPerVolume,
      row.defaultMass,
      row.modifierPersistenceTime,
      row.childRockLifeTimer,
      row.childRockZeroGDamping,
      row.terrainFactorStaticThreshold,
      row.showExplosionFXForSurplusChild,
      row.childRockInactivityLifetime,
      row.gadgetDetachThreshold,
      row.gadgetDestroyThreshold,
      row.dangerToGadgetDamage,
      row.wasteResourceType,
      row.instabilityWavePeriod,
      row.instabilityWaveVariance,
      row.instabilityCurveFactor,
      row.dangerPoolFactor,
      row.explosionDefaultVolume,
      row.hitHistoryWindow,
      row.standardDeviationMultiplier,
      row.timeExponent,
      row.minDeviation,
      row.extractionMagnitude,
      row.maxEffectOnInstability,
      row.fractureParticleEffect,
      row.explosionParticleEffect,
      row.centerRockDestroyParticleEffect,
      row.fullyExtractedRockParticleEffect,
      row.mineablePowerIncreasingFallOff,
      row.mineablePowerLevelRtpc,
      row.mineableDangerBreakingRtpc,
      row.mineableOptimalBreakingRtpc,
      row.mineableMassRtpc,
      row.mineableCrackGlowStrengthRtpc,
      row.miningStartTrigger,
      row.miningStopTrigger,
      row.goodFracturedTrigger,
      row.badFracturedTrigger,
      row.extractedTrigger,
      row.clusterDetectionRadius,
      row.clusterUpperObjectCountDGS,
      row.clusterUpperObjectCountPersistence,
      row.clusterPersistenceTimeout,
      row.resetLifetimeOnMove,
      row.entityIdleBuryOnly,
      row.ref,
      row.path,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, MINING_PARAMS_CSV_FILE),
      stringify([MINING_PARAM_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: MINING_PARAMS_CSV_FILE };
}

async function writeMiningProviderPresetCsv(
  rows: DataCoreMiningProviderPresetRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeMiningProviderPresetResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.providerClass,
      row.system,
      row.location,
      row.groupName,
      row.groupProbability,
      row.entryIndex,
      row.harvestableGuid,
      row.harvestableClass,
      row.harvestablePath,
      row.harvestableEntityGuid,
      row.harvestableEntityClass,
      row.harvestableEntityPath,
      row.harvestableSetupGuid,
      row.harvestableSetupClass,
      row.compositionGuid,
      row.compositionClass,
      row.globalParamsGuid,
      row.audioParamsGuid,
      row.filledFactor,
      row.clusteringGuid,
      row.clusteringClass,
      row.relativeProbability,
      row.geometryTags,
      row.ref,
      row.path,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, MINING_PROVIDER_PRESETS_CSV_FILE),
      stringify([MINING_PROVIDER_PRESET_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: MINING_PROVIDER_PRESETS_CSV_FILE };
}

function buildRawFactResults(
  resultsByCsvFile: Map<string, { rows: number; csvFile: string }>,
): DataCoreRawFactScrapeResult[] {
  return DATACORE_RAW_FACTS.map((rawFact) => {
    const csvFile = rawFact.sourceFiles[0];
    const result = resultsByCsvFile.get(csvFile);
    if (!result) {
      throw new Error(`DataCore raw fact "${rawFact.slug}" is cataloged but not emitted by the scraper (${csvFile}).`);
    }
    return {
      slug: rawFact.slug,
      label: rawFact.label,
      rows: result.rows,
      csvFile: result.csvFile,
    };
  });
}

async function resolveField(
  $: ReturnType<typeof loadXml>,
  spec: DataCoreFieldSelector,
  row: Record<string, string>,
  context: {
    graph?: DataCoreRecordGraphLookup;
    xmlCacheDir: string;
    referencedXmlCache: Map<string, ReturnType<typeof loadXml>>;
  },
): Promise<string> {
  if (typeof spec === 'object' && 'derive' in spec) return spec.derive(row);
  if (typeof spec === 'string') return xmlVal($, spec);

  const source = spec.ref ? await loadReferencedXml($, spec.ref, context) : $;
  if (!source) return '';

  const selection = source(spec.selector);
  if (spec.format === 'count') return selection.length > 0 ? String(selection.length) : '';

  const element = spec.index === undefined ? selection.first() : selection.eq(spec.index);
  const values = spec.attrs?.map((attr) => element.attr(attr) ?? '') ?? [
    spec.attr ? (element.attr(spec.attr) ?? '') : '',
  ];

  if (spec.format === 'scaled-number' && values[0]) return formatScaledNumber(values[0], spec.scale ?? 1);
  if (spec.format === 'number-pair') return values.some(Boolean) ? values.join(spec.separator ?? ' - ') : '';
  if (spec.format === 'scaled-number-pair') {
    if (!values.some(Boolean)) return '';
    return values.map((value) => formatScaledNumber(value, spec.scale ?? 1)).join(spec.separator ?? ' - ');
  }
  if (spec.format === 'product') return formatProduct(values);
  if (spec.format === 'sum') return formatSum(values);
  if (spec.format === 'percent' && values[0]) return formatPercent(values[0]);
  if (spec.format === 'percent-pair') return values.map(formatPercent).join(spec.separator ?? ' / ');

  return values.join(spec.separator ?? ' / ');
}

async function loadReferencedXml(
  $: ReturnType<typeof loadXml>,
  ref: DataCoreFieldReferenceSelector | DataCoreFieldReferenceSelector[],
  context: {
    graph?: DataCoreRecordGraphLookup;
    xmlCacheDir: string;
    referencedXmlCache: Map<string, ReturnType<typeof loadXml>>;
  },
): Promise<ReturnType<typeof loadXml> | undefined> {
  if (!context.graph) return undefined;

  let source = $;
  for (const step of Array.isArray(ref) ? ref : [ref]) {
    const record = resolveReferencedRecord(source, step, context.graph);
    if (!record) return undefined;

    const cached = context.referencedXmlCache.get(record.path);
    if (cached) {
      source = cached;
      continue;
    }

    const xml = await fs.readFile(path.join(context.xmlCacheDir, record.path), 'utf8');
    source = loadXml(xml);
    context.referencedXmlCache.set(record.path, source);
  }

  return source;
}

function resolveReferencedRecord(
  source: ReturnType<typeof loadXml>,
  step: DataCoreFieldReferenceSelector,
  graph: DataCoreRecordGraphLookup,
): ReturnType<DataCoreRecordGraphLookup['getByRef']> {
  const candidates = [step, ...(Array.isArray(step.fallback) ? step.fallback : step.fallback ? [step.fallback] : [])];

  for (const candidate of candidates) {
    const referenceValue = source(candidate.selector).first().attr(candidate.attr)?.trim();
    if (!referenceValue) continue;

    const record =
      candidate.by === 'entityClass' ? graph.getByEntityClass(referenceValue)[0] : graph.getByRef(referenceValue);
    if (record) return record;
  }

  return undefined;
}

function formatProduct(values: string[]): string {
  const presentValues = values.filter(Boolean);
  if (presentValues.length === 0) return '';
  let total = 1;
  for (const value of presentValues) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '';
    total *= num;
  }
  return String(Number(total.toFixed(6)));
}

function formatSum(values: string[]): string {
  const presentValues = values.filter(Boolean);
  if (presentValues.length === 0) return '';
  let total = 0;
  for (const value of presentValues) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '';
    total += num;
  }
  return String(Number(total.toFixed(6)));
}

function formatScaledNumber(value: string, scale: number): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return String(Number((num * scale).toFixed(6)));
}

function formatPercent(value: string): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return `${Number((num * 100).toFixed(2))}%`;
}

function localizationKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '@LOC_EMPTY' || trimmed === '@LOC_UNINITIALIZED') return '';
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}

function resolveManufacturerCode(manufacturer: string, resolver: DataCoreManufacturerResolver | undefined): string {
  const trimmed = manufacturer.trim();
  if (!trimmed) return '';
  return resolver?.resolve(trimmed)?.code || trimmed;
}
