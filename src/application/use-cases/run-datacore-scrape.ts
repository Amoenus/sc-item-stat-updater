import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import {
  ensureToolsInstalled,
  readGameVersion,
  resolveLiveDir,
  runToolAsync,
  type Unp4kTools,
} from '../../io/local/unp4k-tool';
import type {
  DataCoreFieldReferenceSelector,
  DataCoreFieldSelector,
  DataCoreItemTypeConfig,
} from '../../items/datacore/types';
import { extractDataCoreXmlCache } from '../../sources/datacore/acquisition';
import { extractDataCoreBlueprintPools } from '../../sources/datacore/blueprint-pool-extractor';
import { extractDataCoreCommodities } from '../../sources/datacore/commodity-extractor';
import {
  buildDataCoreHaulingComponentClassLookup,
  isDisplayDataCoreComponentClass,
  normalizeDataCoreEntityClass,
  normalizeSpaces,
  resolveDataCoreComponentClass,
} from '../../sources/datacore/component-class-resolver';
import { mapConcurrent } from '../../sources/datacore/concurrency';
import { extractDataCoreContractGenerators } from '../../sources/datacore/contract-generator-extractor';
import { buildDataCoreContractGeneratorIntel } from '../../sources/datacore/contract-generator-intel-builder';
import { buildDataCoreContractHaulingSummary } from '../../sources/datacore/contract-hauling-summary-builder';
import { extractDataCoreContractTemplates } from '../../sources/datacore/contract-template-extractor';
import { extractDataCoreContractTemplateHaulingOrders } from '../../sources/datacore/contract-template-hauling-extractor';
import { extractDataCoreCraftingBlueprints } from '../../sources/datacore/crafting-blueprint-extractor';
import { extractDataCoreFactions } from '../../sources/datacore/faction-extractor';
import { extractDataCoreLocationLabels } from '../../sources/datacore/location-label-extractor';
import { extractDataCoreManufacturers } from '../../sources/datacore/manufacturer-extractor';
import {
  createDataCoreManufacturerResolver,
  type DataCoreManufacturerResolver,
} from '../../sources/datacore/manufacturer-resolver';
import { extractDataCoreMaterialLocalizations } from '../../sources/datacore/material-localization-extractor';
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
import { buildDataCoreMissionContractIntel } from '../../sources/datacore/mission-contract-intel-builder';
import { extractDataCoreMissionLocalization } from '../../sources/datacore/mission-localization-extractor';
import {
  type BuildDataCoreRecordGraphOptions,
  buildDataCoreRecordGraph,
  writeDataCoreRecordGraph,
} from '../../sources/datacore/record-graph';
import { createDataCoreRecordGraphLookup } from '../../sources/datacore/record-graph-loader';
import {
  createDataCoreRelationshipIndex,
  type DataCoreRelationshipIndex,
} from '../../sources/datacore/relationship-index';
import type {
  DataCoreCommodityRecord,
  DataCoreContractGeneratorIntelRecord,
  DataCoreContractGeneratorRecord,
  DataCoreContractHaulingSummaryRecord,
  DataCoreContractTemplateHaulingOrderRecord,
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
  DataCoreMissionContractIntelRecord,
  DataCoreMissionLocalizationRecord,
  DataCoreRecordGraph,
  DataCoreRecordGraphLookup,
  DataCoreRecordNode,
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
import { DATACORE_RAW_FACTS } from '../catalog/category-listing';

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

export interface DataCoreScrapeBlueprintPoolsResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeCraftingBlueprintsResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeMaterialLocalizationsResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeContractGeneratorResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeContractGeneratorIntelResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeContractHaulingSummaryResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeContractTemplateResult {
  rows: number;
  csvFile: string;
}

export interface DataCoreScrapeContractTemplateHaulingResult {
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

export interface DataCoreScrapeMissionContractIntelResult {
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
  skipUnforge?: boolean;
  types?: string[];
  loadTypes?: (repoRoot: string) => Promise<DataCoreTypeEntry[]>;
  resolveLiveDir?: (binDirname: string) => string;
  readGameVersion?: (liveDir: string) => Promise<string>;
  onBlueprintPoolsExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onCraftingBlueprintsExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onMaterialLocalizationsExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  /** Test-only fallback. Production DataCore acquisition extracts Game2.dcb from Data.p4k. */
  findDcbFile?: (liveDir: string) => Promise<string>;
  ensureTools?: (toolDir: string, log: (message: string) => void) => Promise<Unp4kTools>;
  extractPackedDcb?: (p4kPath: string, dcbCacheDir: string, tools: Unp4kTools) => void | Promise<void>;
  countXmlFiles?: (xmlCacheDir: string) => Promise<number>;
  extractXmlCache?: typeof extractDataCoreXmlCache;
  buildRecordGraph?: (options: BuildDataCoreRecordGraphOptions) => Promise<DataCoreRecordGraph>;
  writeRecordGraph?: (graph: DataCoreRecordGraph, outputPath: string) => Promise<void>;
  extractContractGenerators?: typeof extractDataCoreContractGenerators;
  buildContractGeneratorIntel?: typeof buildDataCoreContractGeneratorIntel;
  buildContractHaulingSummary?: typeof buildDataCoreContractHaulingSummary;
  extractContractTemplates?: typeof extractDataCoreContractTemplates;
  extractContractTemplateHaulingOrders?: typeof extractDataCoreContractTemplateHaulingOrders;
  extractCommodities?: typeof extractDataCoreCommodities;
  extractVehicles?: typeof extractDataCoreVehicles;
  extractFactions?: typeof extractDataCoreFactions;
  extractManufacturers?: typeof extractDataCoreManufacturers;
  extractMissionBrokers?: typeof extractDataCoreMissionBrokers;
  buildMissionContractIntel?: typeof buildDataCoreMissionContractIntel;
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
  extractBlueprintPools?: typeof extractDataCoreBlueprintPools;
  extractCraftingBlueprints?: typeof extractDataCoreCraftingBlueprints;
  extractMaterialLocalizations?: typeof extractDataCoreMaterialLocalizations;
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
  onRawFactStart?: (slug: string, total: number) => void;
  onRawFactProgress?: (slug: string, current: number, total: number) => void;
  onTypeStart?: (entry: DataCoreTypeEntry, index: number) => void;
  onCacheHit?: (count: number, xmlCacheDir: string) => void;
  onCacheExtractStart?: (dcbPath: string, xmlCacheDir: string, clearExisting: boolean) => void;
  onCacheExtractProgress?: (count: number) => void;
  onCacheExtractComplete?: (count: number) => void;
  onRecordGraphStart?: (total: number) => void;
  onRecordGraphProgress?: (current: number, total: number) => void;
  onRecordGraphBuilt?: (recordCount: number, outputPath: string, dryRun: boolean) => void;
  onRecordGraphCacheHit?: (recordCount: number, outputPath: string) => void;
  onContractGeneratorsExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onContractGeneratorIntelExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onContractHaulingSummaryExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onContractTemplatesExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onContractTemplateHaulingExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onCommoditiesExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onVehiclesExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onFactionsExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onManufacturersExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onLocationLabelsExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onMissionBrokersExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
  onMissionContractIntelExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;
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
  contractGeneratorIntelResult: DataCoreScrapeContractGeneratorIntelResult;
  contractHaulingSummaryResult: DataCoreScrapeContractHaulingSummaryResult;
  contractTemplateResult: DataCoreScrapeContractTemplateResult;
  contractTemplateHaulingResult: DataCoreScrapeContractTemplateHaulingResult;
  commodityResult: DataCoreScrapeCommodityResult;
  vehicleResult: DataCoreScrapeVehicleResult;
  factionResult: DataCoreScrapeFactionResult;
  manufacturerResult: DataCoreScrapeManufacturerResult;
  locationLabelResult: DataCoreScrapeLocationLabelResult;
  missionBrokerResult: DataCoreScrapeMissionBrokerResult;
  missionContractIntelResult: DataCoreScrapeMissionContractIntelResult;
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

interface DataCoreXmlCacheState {
  xmlFileCount: number;
  reused: boolean;
}

interface FileFingerprint {
  size: number;
  mtimeMs: number;
}

interface DataCoreDcbCacheMetadata {
  sourceP4k: FileFingerprint;
}

interface DataCoreXmlCacheMetadata {
  gameVersion: string;
  dcb: FileFingerprint | null;
}

interface EnsureDataCoreXmlCacheOptions {
  cachedCount: number;
  dcbPath: string;
  gameVersion: string;
  dcbFingerprint: FileFingerprint | null;
  dcbRefreshed: boolean;
  liveDir: string;
  xmlCacheDir: string;
  tools: Unp4kTools;
  forceExtract?: boolean;
  skipUnforge?: boolean;
  extractXmlCache: typeof extractDataCoreXmlCache;
  onToolsLog?: (message: string) => void;
  onCacheHit?: (count: number, xmlCacheDir: string) => void;
  onCacheExtractStart?: (dcbPath: string, xmlCacheDir: string, clearExisting: boolean) => void;
  onCacheExtractProgress?: (count: number) => void;
  onCacheExtractComplete?: (count: number) => void;
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
const CONTRACT_GENERATOR_INTEL_CSV_FILE = 'contract-generator-intel.datacore.csv';
const CONTRACT_HAULING_SUMMARY_CSV_FILE = 'contract-hauling-summary.datacore.csv';
const CONTRACT_TEMPLATES_CSV_FILE = 'contract-templates.datacore.csv';
const CONTRACT_TEMPLATE_HAULING_CSV_FILE = 'contract-template-hauling.datacore.csv';
const COMMODITY_CSV_FILE = 'commodities.datacore.csv';
const VEHICLES_CSV_FILE = 'vehicles.datacore.csv';
const FACTIONS_CSV_FILE = 'factions.datacore.csv';
const MANUFACTURERS_CSV_FILE = 'manufacturers.datacore.csv';
const LOCATION_LABELS_CSV_FILE = 'location-labels.datacore.csv';
const MISSION_BROKERS_CSV_FILE = 'mission-brokers.datacore.csv';
const MISSION_CONTRACT_INTEL_CSV_FILE = 'mission-contract-intel.datacore.csv';
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
  'Controlled Substance Jurisdictions',
  'Controlled Substance Max SCU',
  'Legality Warning Source',
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
  'Success Reputation Rewards',
  'Failure Reputation Rewards',
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
  'Blueprint Reward Pool Guids',
  'Blueprint Rewards',
  'Required Completed Contract Tags',
  'Completion Tags',
  'Record GUID',
  'Record Path',
];
const CONTRACT_GENERATOR_INTEL_HEADERS = [
  'Generator Class',
  'Contract ID',
  'Contract Debug Name',
  'Template Class',
  'Description Key',
  'Description Key Role',
  'Contract Intel',
  'Time Limit',
  'Contract Buy In Amount',
  'Difficulty Profile Class',
  'Record GUID',
  'Record Path',
];
const CONTRACT_HAULING_SUMMARY_HEADERS = [
  'Generator Class',
  'Contract ID',
  'Contract Debug Name',
  'Template Class',
  'Description Key',
  'Description Key Role',
  'Hauling Summary',
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
const CONTRACT_TEMPLATE_HAULING_HEADERS = [
  'Template Class',
  'Objective Debug Name',
  'Order Index',
  'Resource GUID',
  'Resource Class',
  'Resource Name Key',
  'Min SCU',
  'Max SCU',
  'Max Container Size',
  'Order Summary',
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
const MISSION_CONTRACT_INTEL_HEADERS = [
  'Mission Class',
  'Description Key',
  'Contract Intel',
  'Cooldown',
  'Reward',
  'Reward Currency',
  'Time Limit',
  'Efficiency',
  'Mission Difficulty',
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

export interface DataCoreScrapePreparedContext {
  gameVersion: string;
  channel: 'live' | 'ptu';
  dcbPath: string;
  outputBase: string;
  xmlCacheDir: string;
  selectedTypes: DataCoreTypeEntry[];
  allTypes: DataCoreTypeEntry[];
  dryRun: boolean;
}

export interface DataCoreScrapePlan {
  prepare(): Promise<DataCoreScrapePreparedContext>;
  ensureXmlCache(): Promise<DataCoreXmlCacheState>;
  prepareRecordGraph(): Promise<{ recordCount: number; outputPath: string; cached: boolean }>;
  getRawFactStages(): DataCoreRawFactStageDescriptor[];
  extractRawFactStage(stageId: DataCoreRawFactStageId): Promise<{ rows: number; csvFile: string } | null>;
  finalizeRawFacts(): Promise<DataCoreRawFactScrapeResult[]>;
  extractRawFacts(): Promise<DataCoreRawFactScrapeResult[]>;
  getItemTypeStages(): DataCoreItemTypeStageDescriptor[];
  scrapeItemTypeStage(
    typeName: string,
  ): Promise<{ result?: DataCoreScrapeTypeResult; error?: DataCoreScrapeTypeError }>;
  finalizeItemTypes(): Promise<{ results: DataCoreScrapeTypeResult[]; errors: DataCoreScrapeTypeError[] }>;
  scrapeItemTypes(): Promise<{ results: DataCoreScrapeTypeResult[]; errors: DataCoreScrapeTypeError[] }>;
  result(): RunDatacoreScrapeResult;
}

export type DataCoreRawFactStageId =
  | 'contract-generators'
  | 'contract-generator-intel'
  | 'contract-templates'
  | 'contract-template-hauling'
  | 'contract-hauling-summary'
  | 'mission-brokers'
  | 'mission-contract-intel'
  | 'mission-localization'
  | 'blueprint-pools'
  | 'crafting-blueprints'
  | 'material-localizations'
  | 'commodities'
  | 'vehicles'
  | 'factions'
  | 'manufacturers'
  | 'location-labels'
  | 'mining-elements'
  | 'mining-compositions'
  | 'mineable-entities'
  | 'mining-density-overrides'
  | 'mining-clustering'
  | 'mining-harvestable-presets'
  | 'mining-harvestable-setups'
  | 'mining-sub-harvestable-configs'
  | 'mining-quality-distributions'
  | 'mining-quality-quantizations'
  | 'mining-rock-signatures'
  | 'mining-location-labels'
  | 'mining-params'
  | 'mining-provider-presets';

export interface DataCoreRawFactStageDescriptor {
  id: DataCoreRawFactStageId;
  title: string;
}

export interface DataCoreItemTypeStageDescriptor {
  id: string;
  title: string;
}

const DATACORE_RAW_FACT_STAGE_DESCRIPTORS: DataCoreRawFactStageDescriptor[] = [
  { id: 'contract-generators', title: 'Contract generators' },
  { id: 'contract-generator-intel', title: 'Contract generator intel' },
  { id: 'contract-templates', title: 'Contract templates' },
  { id: 'contract-template-hauling', title: 'Contract template hauling' },
  { id: 'contract-hauling-summary', title: 'Contract hauling summary' },
  { id: 'mission-brokers', title: 'Mission brokers' },
  { id: 'mission-contract-intel', title: 'Mission contract intel' },
  { id: 'mission-localization', title: 'Mission localization' },
  { id: 'blueprint-pools', title: 'Blueprint pools' },
  { id: 'crafting-blueprints', title: 'Crafting blueprints' },
  { id: 'material-localizations', title: 'Material localizations' },
  { id: 'commodities', title: 'Commodities' },
  { id: 'vehicles', title: 'Vehicles' },
  { id: 'factions', title: 'Factions' },
  { id: 'manufacturers', title: 'Manufacturers' },
  { id: 'location-labels', title: 'Location labels' },
  { id: 'mining-elements', title: 'Mining elements' },
  { id: 'mining-compositions', title: 'Mining compositions' },
  { id: 'mineable-entities', title: 'Mineable entities' },
  { id: 'mining-density-overrides', title: 'Mining density overrides' },
  { id: 'mining-clustering', title: 'Mining clustering' },
  { id: 'mining-harvestable-presets', title: 'Mining harvestable presets' },
  { id: 'mining-harvestable-setups', title: 'Mining harvestable setups' },
  { id: 'mining-sub-harvestable-configs', title: 'Mining sub-harvestable configs' },
  { id: 'mining-quality-distributions', title: 'Mining quality distributions' },
  { id: 'mining-quality-quantizations', title: 'Mining quality quantizations' },
  { id: 'mining-rock-signatures', title: 'Mining rock signatures' },
  { id: 'mining-location-labels', title: 'Mining location labels' },
  { id: 'mining-params', title: 'Mining params' },
  { id: 'mining-provider-presets', title: 'Mining provider presets' },
];

interface DataCoreScrapePreparedState extends DataCoreScrapePreparedContext {
  versionTag: string;
  liveDir: string;
  recordGraphPath: string;
  tools: Unp4kTools;
  dcbFingerprint: FileFingerprint | null;
  dcbRefreshed: boolean;
}

interface DataCoreScrapeGraphState {
  xmlCache: DataCoreXmlCacheState;
  recordGraph: DataCoreRecordGraph;
  graphLookup: DataCoreRecordGraphLookup;
  recordGraphCached: boolean;
}

interface DataCoreRawFactStageState {
  rawFactResults: DataCoreRawFactScrapeResult[];
  manufacturerResolver: DataCoreManufacturerResolver;
  contractGeneratorResult: DataCoreScrapeContractGeneratorResult;
  contractGeneratorIntelResult: DataCoreScrapeContractGeneratorIntelResult;
  contractHaulingSummaryResult: DataCoreScrapeContractHaulingSummaryResult;
  contractTemplateResult: DataCoreScrapeContractTemplateResult;
  contractTemplateHaulingResult: DataCoreScrapeContractTemplateHaulingResult;
  commodityResult: DataCoreScrapeCommodityResult;
  vehicleResult: DataCoreScrapeVehicleResult;
  factionResult: DataCoreScrapeFactionResult;
  manufacturerResult: DataCoreScrapeManufacturerResult;
  locationLabelResult: DataCoreScrapeLocationLabelResult;
  missionBrokerResult: DataCoreScrapeMissionBrokerResult;
  missionContractIntelResult: DataCoreScrapeMissionContractIntelResult;
  missionLocalizationResult: DataCoreScrapeMissionLocalizationResult;
  blueprintPoolResult: DataCoreScrapeBlueprintPoolsResult;
  craftingBlueprintResult: DataCoreScrapeCraftingBlueprintsResult;
  materialLocalizationResult: DataCoreScrapeMaterialLocalizationsResult;
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
}

export function createDataCoreScrapePlan(options: RunDatacoreScrapeOptions): DataCoreScrapePlan {
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
  const buildContractGeneratorIntel = options.buildContractGeneratorIntel ?? buildDataCoreContractGeneratorIntel;
  const buildContractHaulingSummary = options.buildContractHaulingSummary ?? buildDataCoreContractHaulingSummary;
  const extractContractTemplates = options.extractContractTemplates ?? extractDataCoreContractTemplates;
  const extractContractTemplateHaulingOrders =
    options.extractContractTemplateHaulingOrders ?? extractDataCoreContractTemplateHaulingOrders;
  const extractCommodities = options.extractCommodities ?? extractDataCoreCommodities;
  const extractVehicles = options.extractVehicles ?? extractDataCoreVehicles;
  const extractFactions = options.extractFactions ?? extractDataCoreFactions;
  const extractManufacturers = options.extractManufacturers ?? extractDataCoreManufacturers;
  const extractMissionBrokers = options.extractMissionBrokers ?? extractDataCoreMissionBrokers;
  const buildMissionContractIntel = options.buildMissionContractIntel ?? buildDataCoreMissionContractIntel;
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
  const extractBlueprintPools = options.extractBlueprintPools ?? extractDataCoreBlueprintPools;
  const extractCraftingBlueprints = options.extractCraftingBlueprints ?? extractDataCoreCraftingBlueprints;
  const extractMaterialLocalizations = options.extractMaterialLocalizations ?? extractDataCoreMaterialLocalizations;

  let prepared: DataCoreScrapePreparedState | undefined;
  let graphState: DataCoreScrapeGraphState | undefined;
  let rawFacts: DataCoreRawFactStageState | undefined;
  const rawFactParts: Partial<DataCoreRawFactStageState> = {};
  let contractGeneratorRowsForBuilders: DataCoreContractGeneratorRecord[] | undefined;
  let contractTemplateHaulingRowsForBuilders: DataCoreContractTemplateHaulingOrderRecord[] | undefined;
  let missionBrokerRowsForBuilders: DataCoreMissionBrokerRecord[] | undefined;
  let typeResults: { results: DataCoreScrapeTypeResult[]; errors: DataCoreScrapeTypeError[] } | undefined;
  const typeParts = new Map<string, { result?: DataCoreScrapeTypeResult; error?: DataCoreScrapeTypeError }>();

  function requirePrepared(): DataCoreScrapePreparedState {
    if (!prepared) throw new Error('DataCore scrape plan has not been prepared.');
    return prepared;
  }

  function requireGraph(): DataCoreScrapePreparedState & DataCoreScrapeGraphState {
    if (!prepared || !graphState) throw new Error('DataCore record graph has not been prepared.');
    return { ...prepared, ...graphState };
  }

  function requireRawFacts(): DataCoreRawFactStageState {
    if (!rawFacts) throw new Error('DataCore raw facts have not been extracted.');
    return rawFacts;
  }

  function requireRawFactPart<K extends keyof DataCoreRawFactStageState>(key: K): DataCoreRawFactStageState[K] {
    const value = rawFactParts[key];
    if (value === undefined) {
      throw new Error(`DataCore raw fact stage "${String(key)}" has not completed.`);
    }
    return value as DataCoreRawFactStageState[K];
  }

  return {
    async prepare() {
      if (prepared) return prepared;

      const allTypes = await loadTypes(options.repoRoot);
      const selectedTypes = selectTypes(allTypes, options.types ?? []);
      const binDirname = options.binDirname ?? path.join(options.repoRoot, 'bin');
      const liveDir = resolveLive(binDirname);
      const version = await readVersion(liveDir);
      const ptu = options.ptu ? '-ptu' : '-live';
      const versionTag = formatDataCoreVersionTag(version, ptu);
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
      const {
        dcbPath,
        refreshed: dcbRefreshed,
        dcbFingerprint,
      } = await resolveCurrentDcbFile({
        liveDir,
        dcbCacheDir,
        tools,
        extractPackedDcb,
        forceExtract: options.forceExtract,
        fallbackDcbPath,
      });

      prepared = {
        gameVersion: version,
        channel: options.ptu ? 'ptu' : 'live',
        versionTag,
        liveDir,
        dcbPath,
        outputBase,
        xmlCacheDir,
        recordGraphPath,
        selectedTypes,
        allTypes,
        dryRun: Boolean(options.dryRun),
        tools,
        dcbFingerprint,
        dcbRefreshed,
      };

      options.onPrepared?.(prepared);
      return prepared;
    },

    async ensureXmlCache() {
      const state = requirePrepared();
      const xmlCache = await ensureDataCoreXmlCache({
        cachedCount: await countXmlFiles(state.xmlCacheDir),
        dcbPath: state.dcbPath,
        gameVersion: state.gameVersion,
        dcbFingerprint: state.dcbFingerprint,
        dcbRefreshed: state.dcbRefreshed,
        liveDir: state.liveDir,
        xmlCacheDir: state.xmlCacheDir,
        tools: state.tools,
        forceExtract: options.forceExtract,
        skipUnforge: options.skipUnforge,
        extractXmlCache,
        onToolsLog: options.onToolsLog,
        onCacheHit: options.onCacheHit,
        onCacheExtractStart: options.onCacheExtractStart,
        onCacheExtractProgress: options.onCacheExtractProgress,
        onCacheExtractComplete: options.onCacheExtractComplete,
      });

      graphState = graphState
        ? { ...graphState, xmlCache }
        : {
            xmlCache,
            recordGraph: undefined as unknown as DataCoreRecordGraph,
            graphLookup: undefined as unknown as DataCoreRecordGraphLookup,
            recordGraphCached: false,
          };
      return xmlCache;
    },

    async prepareRecordGraph() {
      const state = requirePrepared();
      if (!graphState?.xmlCache) await this.ensureXmlCache();
      const xmlCache = graphState?.xmlCache;
      if (!xmlCache) throw new Error('DataCore XML cache is not ready.');

      let recordGraph: DataCoreRecordGraph;
      const graphExists =
        xmlCache.reused &&
        (await fs
          .stat(state.recordGraphPath)
          .then(() => true)
          .catch(() => false));

      if (graphExists) {
        recordGraph = JSON.parse(await fs.readFile(state.recordGraphPath, 'utf8')) as DataCoreRecordGraph;
        options.onRecordGraphCacheHit?.(recordGraph.recordCount, state.recordGraphPath);
      } else {
        recordGraph = await buildRecordGraph({
          xmlCacheDir: state.xmlCacheDir,
          onStart: options.onRecordGraphStart,
          onProgress: options.onRecordGraphProgress,
        });
        if (!options.dryRun) {
          await writeRecordGraph(recordGraph, state.recordGraphPath);
        }
      }

      options.onRecordGraphBuilt?.(recordGraph.recordCount, state.recordGraphPath, Boolean(options.dryRun));
      graphState = {
        xmlCache,
        recordGraph,
        graphLookup: createDataCoreRecordGraphLookup(recordGraph),
        recordGraphCached: graphExists,
      };

      return { recordCount: recordGraph.recordCount, outputPath: state.recordGraphPath, cached: graphExists };
    },

    getRawFactStages() {
      return DATACORE_RAW_FACT_STAGE_DESCRIPTORS;
    },

    async extractRawFactStage(stageId) {
      const { outputBase, xmlCacheDir, graphLookup, recordGraph } = requireGraph();
      if (!rawFactParts.manufacturerResolver) {
        rawFactParts.manufacturerResolver = createDataCoreManufacturerResolver(graphLookup);
      }

      switch (stageId) {
        case 'contract-generators': {
          const progress = createRawFactProgressReporter(options, 'contract-generators');
          contractGeneratorRowsForBuilders = await extractContractGenerators({
            xmlCacheDir,
            graph: graphLookup,
            onProgress: progress,
          });
          const result = await writeContractGeneratorCsv(contractGeneratorRowsForBuilders, {
            outputBase,
            dryRun: options.dryRun,
          });
          rawFactParts.contractGeneratorResult = result;
          options.onContractGeneratorsExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'contract-generator-intel': {
          if (!contractGeneratorRowsForBuilders) {
            throw new Error('Contract generator rows must be extracted before generator intel.');
          }
          const rows = buildContractGeneratorIntel(contractGeneratorRowsForBuilders, { graph: graphLookup });
          const result = await writeContractGeneratorIntelCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.contractGeneratorIntelResult = result;
          options.onContractGeneratorIntelExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'contract-templates': {
          const progress = createRawFactProgressReporter(options, 'contract-templates');
          const rows = await extractContractTemplates({ xmlCacheDir, graph: graphLookup, onProgress: progress });
          const result = await writeContractTemplateCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.contractTemplateResult = result;
          options.onContractTemplatesExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'contract-template-hauling': {
          const progress = createRawFactProgressReporter(options, 'contract-template-hauling');
          contractTemplateHaulingRowsForBuilders = await extractContractTemplateHaulingOrders({
            xmlCacheDir,
            graph: graphLookup,
            onProgress: progress,
          });
          const result = await writeContractTemplateHaulingCsv(contractTemplateHaulingRowsForBuilders, {
            outputBase,
            dryRun: options.dryRun,
          });
          rawFactParts.contractTemplateHaulingResult = result;
          options.onContractTemplateHaulingExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'contract-hauling-summary': {
          if (!contractGeneratorRowsForBuilders || !contractTemplateHaulingRowsForBuilders) {
            throw new Error('Contract generator and hauling order rows must be extracted before hauling summary.');
          }
          const rows = buildContractHaulingSummary(
            contractGeneratorRowsForBuilders,
            contractTemplateHaulingRowsForBuilders,
          );
          const result = await writeContractHaulingSummaryCsv(rows, { outputBase, dryRun: Boolean(options.dryRun) });
          rawFactParts.contractHaulingSummaryResult = result;
          options.onContractHaulingSummaryExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'mission-brokers': {
          const progress = createRawFactProgressReporter(options, 'mission-brokers');
          missionBrokerRowsForBuilders = await extractMissionBrokers({
            xmlCacheDir,
            graph: graphLookup,
            onProgress: progress,
          });
          const result = await writeMissionBrokerCsv(missionBrokerRowsForBuilders, {
            outputBase,
            dryRun: options.dryRun,
          });
          rawFactParts.missionBrokerResult = result;
          options.onMissionBrokersExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'mission-contract-intel': {
          if (!missionBrokerRowsForBuilders) {
            throw new Error('Mission broker rows must be extracted before mission contract intel.');
          }
          const rows = buildMissionContractIntel(missionBrokerRowsForBuilders);
          const result = await writeMissionContractIntelCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.missionContractIntelResult = result;
          options.onMissionContractIntelExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'mission-localization': {
          const rows = extractMissionLocalization(recordGraph);
          const result = await writeMissionLocalizationCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.missionLocalizationResult = result;
          options.onMissionLocalizationExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'blueprint-pools': {
          const progress = createRawFactProgressReporter(options, 'blueprint-pools');
          const rows = await extractBlueprintPools({ xmlCacheDir, graph: graphLookup, onProgress: progress });
          const result = await writeBlueprintPoolsCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.blueprintPoolResult = result;
          options.onBlueprintPoolsExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'crafting-blueprints': {
          const progress = createRawFactProgressReporter(options, 'crafting-blueprints');
          const rows = await extractCraftingBlueprints({ xmlCacheDir, graph: graphLookup, onProgress: progress });
          const result = await writeCraftingBlueprintsCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.craftingBlueprintResult = result;
          options.onCraftingBlueprintsExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'material-localizations': {
          const progress = createRawFactProgressReporter(options, 'material-localizations');
          const rows = await extractMaterialLocalizations({ xmlCacheDir, graph: graphLookup, onProgress: progress });
          const result = await writeMaterialLocalizationCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.materialLocalizationResult = result;
          options.onMaterialLocalizationsExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'commodities': {
          const rows = await extractCommodities({ xmlCacheDir, graph: graphLookup });
          const result = await writeCommodityCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.commodityResult = result;
          options.onCommoditiesExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'vehicles': {
          const rows = await extractVehicles({ xmlCacheDir, graph: graphLookup });
          const result = await writeVehicleCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.vehicleResult = result;
          options.onVehiclesExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'factions': {
          const rows = await extractFactions({ xmlCacheDir, graph: graphLookup });
          const result = await writeFactionCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.factionResult = result;
          options.onFactionsExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'manufacturers': {
          const rows = await extractManufacturers({ xmlCacheDir, graph: graphLookup });
          const result = await writeManufacturerCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.manufacturerResult = result;
          options.onManufacturersExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'location-labels': {
          const rows = await extractLocationLabels({ xmlCacheDir, graph: graphLookup });
          const result = await writeLocationLabelCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.locationLabelResult = result;
          options.onLocationLabelsExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'mining-elements': {
          const rows = await extractMiningElements({ xmlCacheDir, graph: graphLookup });
          const result = await writeMiningElementCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.miningElementResult = result;
          options.onMiningElementsExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'mining-compositions': {
          const rows = await extractMiningCompositions({ xmlCacheDir, graph: graphLookup });
          const result = await writeMiningCompositionCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.miningCompositionResult = result;
          options.onMiningCompositionsExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'mineable-entities': {
          const rows = await extractMineableEntities({ xmlCacheDir, graph: graphLookup });
          const result = await writeMineableEntityCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.mineableEntityResult = result;
          options.onMineableEntitiesExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'mining-density-overrides': {
          const rows = await extractMiningDensityOverrides({ xmlCacheDir, graph: graphLookup });
          const result = await writeMiningDensityOverrideCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.miningDensityOverrideResult = result;
          options.onMiningDensityOverridesExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'mining-clustering': {
          const rows = await extractMiningClustering({ xmlCacheDir, graph: graphLookup });
          const result = await writeMiningClusteringCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.miningClusteringResult = result;
          options.onMiningClusteringExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'mining-harvestable-presets': {
          const rows = await extractMiningHarvestablePresets({ xmlCacheDir, graph: graphLookup });
          const result = await writeMiningHarvestablePresetCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.miningHarvestablePresetResult = result;
          options.onMiningHarvestablePresetsExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'mining-harvestable-setups': {
          const rows = await extractMiningHarvestableSetups({ xmlCacheDir, graph: graphLookup });
          const result = await writeMiningHarvestableSetupCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.miningHarvestableSetupResult = result;
          options.onMiningHarvestableSetupsExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'mining-sub-harvestable-configs': {
          const rows = await extractMiningSubHarvestableConfigs({ xmlCacheDir, graph: graphLookup });
          const result = await writeMiningSubHarvestableConfigCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.miningSubHarvestableConfigResult = result;
          options.onMiningSubHarvestableConfigsExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'mining-quality-distributions': {
          const rows = await extractMiningQualityDistributions({ xmlCacheDir, graph: graphLookup });
          const result = await writeMiningQualityDistributionCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.miningQualityDistributionResult = result;
          options.onMiningQualityDistributionsExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'mining-quality-quantizations': {
          const rows = await extractMiningQualityQuantizations({ xmlCacheDir, graph: graphLookup });
          const result = await writeMiningQualityQuantizationCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.miningQualityQuantizationResult = result;
          options.onMiningQualityQuantizationsExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'mining-rock-signatures': {
          const rows = await extractMiningRockSignatures({ xmlCacheDir, graph: graphLookup });
          const result = await writeMiningRockSignatureCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.miningRockSignatureResult = result;
          options.onMiningRockSignaturesExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'mining-location-labels': {
          const rows = await extractMiningLocationLabels({ xmlCacheDir, graph: graphLookup });
          const result = await writeMiningLocationLabelCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.miningLocationLabelResult = result;
          options.onMiningLocationLabelsExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'mining-params': {
          const rows = await extractMiningParams({ xmlCacheDir, graph: graphLookup });
          const result = await writeMiningParamCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.miningParamResult = result;
          options.onMiningParamsExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
        case 'mining-provider-presets': {
          const rows = await extractMiningProviderPresets({ xmlCacheDir, graph: graphLookup });
          const result = await writeMiningProviderPresetCsv(rows, { outputBase, dryRun: options.dryRun });
          rawFactParts.miningProviderPresetResult = result;
          options.onMiningProviderPresetsExtracted?.(result.rows, result.csvFile, Boolean(options.dryRun));
          return result;
        }
      }
    },

    async finalizeRawFacts() {
      const rawFactResults = buildRawFactResults(
        new Map([
          [requireRawFactPart('contractGeneratorResult').csvFile, requireRawFactPart('contractGeneratorResult')],
          [
            requireRawFactPart('contractGeneratorIntelResult').csvFile,
            requireRawFactPart('contractGeneratorIntelResult'),
          ],
          [
            requireRawFactPart('contractHaulingSummaryResult').csvFile,
            requireRawFactPart('contractHaulingSummaryResult'),
          ],
          [requireRawFactPart('contractTemplateResult').csvFile, requireRawFactPart('contractTemplateResult')],
          [
            requireRawFactPart('contractTemplateHaulingResult').csvFile,
            requireRawFactPart('contractTemplateHaulingResult'),
          ],
          [requireRawFactPart('commodityResult').csvFile, requireRawFactPart('commodityResult')],
          [requireRawFactPart('vehicleResult').csvFile, requireRawFactPart('vehicleResult')],
          [requireRawFactPart('factionResult').csvFile, requireRawFactPart('factionResult')],
          [requireRawFactPart('manufacturerResult').csvFile, requireRawFactPart('manufacturerResult')],
          [requireRawFactPart('locationLabelResult').csvFile, requireRawFactPart('locationLabelResult')],
          [requireRawFactPart('missionBrokerResult').csvFile, requireRawFactPart('missionBrokerResult')],
          [requireRawFactPart('missionContractIntelResult').csvFile, requireRawFactPart('missionContractIntelResult')],
          [requireRawFactPart('missionLocalizationResult').csvFile, requireRawFactPart('missionLocalizationResult')],
          [requireRawFactPart('miningLocationLabelResult').csvFile, requireRawFactPart('miningLocationLabelResult')],
        ]),
      );
      rawFactParts.rawFactResults = rawFactResults;
      rawFacts = {
        rawFactResults,
        manufacturerResolver: requireRawFactPart('manufacturerResolver'),
        contractGeneratorResult: requireRawFactPart('contractGeneratorResult'),
        contractGeneratorIntelResult: requireRawFactPart('contractGeneratorIntelResult'),
        contractHaulingSummaryResult: requireRawFactPart('contractHaulingSummaryResult'),
        contractTemplateResult: requireRawFactPart('contractTemplateResult'),
        contractTemplateHaulingResult: requireRawFactPart('contractTemplateHaulingResult'),
        commodityResult: requireRawFactPart('commodityResult'),
        vehicleResult: requireRawFactPart('vehicleResult'),
        factionResult: requireRawFactPart('factionResult'),
        manufacturerResult: requireRawFactPart('manufacturerResult'),
        locationLabelResult: requireRawFactPart('locationLabelResult'),
        missionBrokerResult: requireRawFactPart('missionBrokerResult'),
        missionContractIntelResult: requireRawFactPart('missionContractIntelResult'),
        missionLocalizationResult: requireRawFactPart('missionLocalizationResult'),
        blueprintPoolResult: requireRawFactPart('blueprintPoolResult'),
        craftingBlueprintResult: requireRawFactPart('craftingBlueprintResult'),
        materialLocalizationResult: requireRawFactPart('materialLocalizationResult'),
        miningElementResult: requireRawFactPart('miningElementResult'),
        miningCompositionResult: requireRawFactPart('miningCompositionResult'),
        mineableEntityResult: requireRawFactPart('mineableEntityResult'),
        miningDensityOverrideResult: requireRawFactPart('miningDensityOverrideResult'),
        miningClusteringResult: requireRawFactPart('miningClusteringResult'),
        miningHarvestablePresetResult: requireRawFactPart('miningHarvestablePresetResult'),
        miningHarvestableSetupResult: requireRawFactPart('miningHarvestableSetupResult'),
        miningSubHarvestableConfigResult: requireRawFactPart('miningSubHarvestableConfigResult'),
        miningQualityDistributionResult: requireRawFactPart('miningQualityDistributionResult'),
        miningQualityQuantizationResult: requireRawFactPart('miningQualityQuantizationResult'),
        miningRockSignatureResult: requireRawFactPart('miningRockSignatureResult'),
        miningLocationLabelResult: requireRawFactPart('miningLocationLabelResult'),
        miningParamResult: requireRawFactPart('miningParamResult'),
        miningProviderPresetResult: requireRawFactPart('miningProviderPresetResult'),
      };
      return rawFactResults;
    },

    async extractRawFacts() {
      for (const stage of DATACORE_RAW_FACT_STAGE_DESCRIPTORS) {
        await this.extractRawFactStage(stage.id);
      }
      return this.finalizeRawFacts();
    },

    getItemTypeStages() {
      const { selectedTypes } = requirePrepared();
      return selectedTypes.map((entry) => ({ id: entry.name, title: entry.name }));
    },

    async scrapeItemTypeStage(typeName) {
      const { outputBase, xmlCacheDir, graphLookup, selectedTypes } = requireGraph();
      const { manufacturerResolver } = requireRawFacts();
      const entry = selectedTypes.find((candidate) => candidate.name === typeName);
      if (!entry) {
        throw new Error(`Unknown DataCore item type stage "${typeName}".`);
      }

      try {
        const result = await scrapeDataCoreType(entry, {
          repoRoot: options.repoRoot,
          xmlCacheDir,
          outputBase,
          dryRun: options.dryRun,
          manufacturerResolver,
          graph: graphLookup,
        });
        const value = { result };
        typeParts.set(entry.name, value);
        return value;
      } catch (err) {
        const error = { type: entry.name, message: err instanceof Error ? err.message : String(err) };
        const value = { error };
        typeParts.set(entry.name, value);
        return value;
      }
    },

    async finalizeItemTypes() {
      const { outputBase, selectedTypes } = requirePrepared();
      const results: DataCoreScrapeTypeResult[] = [];
      const errors: DataCoreScrapeTypeError[] = [];

      for (const entry of selectedTypes) {
        const value = typeParts.get(entry.name);
        if (!value) throw new Error(`DataCore item type stage "${entry.name}" has not completed.`);
        if (value.result) results.push(value.result);
        if (value.error) errors.push(value.error);
      }

      if (errors.length === 0) {
        await reconcileDataCoreComponentClasses(outputBase, selectedTypes, options.dryRun);
      }

      typeResults = { results, errors };
      return typeResults;
    },

    async scrapeItemTypes() {
      const { selectedTypes } = requirePrepared();
      for (let index = 0; index < selectedTypes.length; index++) {
        const entry = selectedTypes[index];
        options.onTypeStart?.(entry, index);
        await this.scrapeItemTypeStage(entry.name);
      }
      return this.finalizeItemTypes();
    },

    result() {
      const state = requirePrepared();
      const graph = graphState;
      if (!graph) throw new Error('DataCore record graph has not been prepared.');
      const facts = requireRawFacts();
      if (!typeResults) throw new Error('DataCore item types have not been scraped.');

      return {
        exitCode: typeResults.errors.length > 0 ? 1 : 0,
        gameVersion: state.gameVersion,
        channel: state.channel,
        versionTag: state.versionTag,
        dcbPath: state.dcbPath,
        outputBase: state.outputBase,
        xmlCacheDir: state.xmlCacheDir,
        allTypes: state.allTypes,
        selectedTypes: state.selectedTypes,
        recordGraph: {
          recordCount: graph.recordGraph.recordCount,
          outputPath: state.recordGraphPath,
        },
        contractGeneratorResult: facts.contractGeneratorResult,
        contractGeneratorIntelResult: facts.contractGeneratorIntelResult,
        contractHaulingSummaryResult: facts.contractHaulingSummaryResult,
        contractTemplateResult: facts.contractTemplateResult,
        contractTemplateHaulingResult: facts.contractTemplateHaulingResult,
        commodityResult: facts.commodityResult,
        vehicleResult: facts.vehicleResult,
        factionResult: facts.factionResult,
        manufacturerResult: facts.manufacturerResult,
        locationLabelResult: facts.locationLabelResult,
        missionBrokerResult: facts.missionBrokerResult,
        missionContractIntelResult: facts.missionContractIntelResult,
        missionLocalizationResult: facts.missionLocalizationResult,
        miningElementResult: facts.miningElementResult,
        miningCompositionResult: facts.miningCompositionResult,
        mineableEntityResult: facts.mineableEntityResult,
        miningDensityOverrideResult: facts.miningDensityOverrideResult,
        miningClusteringResult: facts.miningClusteringResult,
        miningHarvestablePresetResult: facts.miningHarvestablePresetResult,
        miningHarvestableSetupResult: facts.miningHarvestableSetupResult,
        miningSubHarvestableConfigResult: facts.miningSubHarvestableConfigResult,
        miningQualityDistributionResult: facts.miningQualityDistributionResult,
        miningQualityQuantizationResult: facts.miningQualityQuantizationResult,
        miningRockSignatureResult: facts.miningRockSignatureResult,
        miningLocationLabelResult: facts.miningLocationLabelResult,
        miningParamResult: facts.miningParamResult,
        miningProviderPresetResult: facts.miningProviderPresetResult,
        rawFactResults: facts.rawFactResults,
        results: typeResults.results,
        errors: typeResults.errors,
      };
    },
  };
}

export async function runDatacoreScrape(options: RunDatacoreScrapeOptions): Promise<RunDatacoreScrapeResult> {
  const plan = createDataCoreScrapePlan(options);
  await plan.prepare();
  await plan.ensureXmlCache();
  await plan.prepareRecordGraph();
  await plan.extractRawFacts();
  await plan.scrapeItemTypes();
  return plan.result();
}

function selectTypes(allTypes: DataCoreTypeEntry[], requestedNames: string[]): DataCoreTypeEntry[] {
  if (requestedNames.length === 0) return allTypes;

  return requestedNames.map((name) => {
    const found = allTypes.find((entry) => entry.name === name);
    if (!found) throw new Error(`Unknown item type: "${name}". Run with --list to see valid types.`);
    return found;
  });
}

function formatDataCoreVersionTag(version: string, channelSuffix: '-live' | '-ptu'): string {
  const trimmed = version.trim();
  if (/-?(?:live|ptu)(?:\.\d+)?$/i.test(trimmed)) {
    return trimmed.replace(/-(live|ptu)/i, (_match, channel: string) => `-${channel.toLowerCase()}`);
  }

  const parts = trimmed.split('.');
  if (parts.length === 4 && /^\d+$/.test(parts[3])) {
    return `${parts.slice(0, 3).join('.')}${channelSuffix}.${parts[3]}`;
  }

  return `${trimmed}${channelSuffix}`;
}

async function fileFingerprint(filePath: string): Promise<FileFingerprint | null> {
  try {
    const stats = await fs.stat(filePath);
    return { size: stats.size, mtimeMs: Math.round(stats.mtimeMs) };
  } catch {
    return null;
  }
}

function sameFingerprint(left: FileFingerprint | null, right: FileFingerprint | null): boolean {
  if (!left || !right) return left === right;
  return left.size === right.size && left.mtimeMs === right.mtimeMs;
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function resolveCurrentDcbFile(options: {
  liveDir: string;
  dcbCacheDir: string;
  tools: Unp4kTools;
  extractPackedDcb: (p4kPath: string, dcbCacheDir: string, tools: Unp4kTools) => void | Promise<void>;
  forceExtract?: boolean;
  fallbackDcbPath?: string;
}): Promise<{ dcbPath: string; refreshed: boolean; dcbFingerprint: FileFingerprint | null }> {
  const p4kPath = path.join(options.liveDir, 'Data.p4k');
  const p4kFingerprint = await fileFingerprint(p4kPath);

  if (!p4kFingerprint) {
    if (options.fallbackDcbPath) {
      return {
        dcbPath: options.fallbackDcbPath,
        refreshed: false,
        dcbFingerprint: await fileFingerprint(options.fallbackDcbPath),
      };
    }
    throw new Error(`Data.p4k not found at ${p4kPath}. Set SC_LIVE_DIR to a valid game install.`);
  }

  const packedDcbPath = path.join(options.dcbCacheDir, 'Data', 'Game2.dcb');
  const packedDcbFingerprint = await fileFingerprint(packedDcbPath);
  const metadataPath = path.join(options.dcbCacheDir, '.metadata.json');
  const metadata = await readJsonFile<DataCoreDcbCacheMetadata>(metadataPath);
  const sourceMatches = sameFingerprint(metadata?.sourceP4k ?? null, p4kFingerprint);
  let refreshed = false;
  if (options.forceExtract || !packedDcbFingerprint || !sourceMatches) {
    await fs.rm(options.dcbCacheDir, { recursive: true, force: true });
    await fs.mkdir(options.dcbCacheDir, { recursive: true });
    await options.extractPackedDcb(p4kPath, options.dcbCacheDir, options.tools);
    await writeJsonFile(metadataPath, { sourceP4k: p4kFingerprint } satisfies DataCoreDcbCacheMetadata);
    refreshed = true;
  }

  return { dcbPath: packedDcbPath, refreshed, dcbFingerprint: await fileFingerprint(packedDcbPath) };
}

async function extractPackedDataCoreDcb(p4kPath: string, dcbCacheDir: string, tools: Unp4kTools): Promise<void> {
  await runToolAsync(tools.unp4k, [p4kPath, 'Game2.dcb'], { cwd: dcbCacheDir, stdio: 'ignore' });
}

async function scrapeDataCoreType(
  entry: DataCoreTypeEntry,
  options: {
    repoRoot: string;
    xmlCacheDir: string;
    outputBase: string;
    dryRun?: boolean;
    manufacturerResolver?: DataCoreManufacturerResolver;
    graph?: DataCoreRecordGraphLookup;
  },
): Promise<DataCoreScrapeTypeResult> {
  const { name, csvFile, typeConfig } = entry;
  const xmlCandidates = await collectDataCoreTypeXmlCandidates(typeConfig, {
    xmlCacheDir: options.xmlCacheDir,
    graph: options.graph,
  });
  const typeHeaders = Object.keys(typeConfig.fieldSelectors);
  const headers = [...COMMON_HEADERS, ...typeHeaders];
  const rows: string[][] = [];
  const referencedXmlCache = new Map<string, ReturnType<typeof loadXml>>();
  const relationships = createDataCoreRelationshipIndex(options.graph);
  const entityClassToHaulingClass = buildDataCoreHaulingComponentClassLookup(relationships);
  const scmdbComponentClassByRef = await loadScmdbComponentClassLookup({
    repoRoot: options.repoRoot,
    versionTag: path.basename(options.outputBase),
  });
  let skipped = 0;

  const mappedRows = await mapConcurrent(
    xmlCandidates,
    async ({ xmlPath, countAsSkipped }) => {
      const xml = await fs.readFile(xmlPath, 'utf8');
      let $: ReturnType<typeof loadXml>;
      try {
        $ = loadXml(xml);
      } catch {
        if (countAsSkipped) skipped++;
        return null;
      }

      if (typeConfig.recordSelector && $(typeConfig.recordSelector).length === 0) {
        if (countAsSkipped) skipped++;
        return null;
      }

      let entityClass = extractEntityClass($);
      if (!entityClass) {
        entityClass = path.basename(xmlPath, path.extname(xmlPath));
      }

      if (!entityClass || entityClass.startsWith('__')) {
        if (countAsSkipped) skipped++;
        return null;
      }

      const attachDef = extractAttachDef($);
      const health = extractHealth($);
      const attachLocalization = $('SAttachableComponentParams AttachDef > Localization').first();
      const record = getDataCoreRecordForEntityClass(entityClass, relationships);
      const manufacturer = resolveComponentManufacturerCode(
        record,
        attachDef.manufacturer,
        options.manufacturerResolver,
      );
      let componentClass = resolveDataCoreComponentClass(attachDef.subtype, entityClass, entityClassToHaulingClass);
      if (!isDisplayDataCoreComponentClass(componentClass)) {
        componentClass = scmdbComponentClassByRef.get(record?.ref.toLowerCase() ?? '') ?? componentClass;
      }
      const rowRecord: Record<string, string> = {
        'Entity Class': entityClass,
        'Name Key':
          getDataCoreGraphLocalizationKey(record, 'name') || localizationKey(attachLocalization.attr('Name') ?? ''),
        'Short Name Key':
          getDataCoreGraphLocalizationKey(record, 'shortName') ||
          localizationKey(attachLocalization.attr('ShortName') ?? ''),
        'Description Key':
          getDataCoreGraphLocalizationKey(record, 'description') ||
          localizationKey(attachLocalization.attr('Description') ?? ''),
        Manufacturer: manufacturer,
        Size: attachDef.size,
        Grade: attachDef.grade,
        Class: componentClass,
        Health: health,
      };

      for (const col of typeHeaders) {
        const spec = typeConfig.fieldSelectors[col];
        if (!spec) {
          rowRecord[col] = '';
          continue;
        }
        const value = await resolveField($, spec, rowRecord, {
          graph: options.graph,
          record,
          relationships,
          xmlCacheDir: options.xmlCacheDir,
          referencedXmlCache,
        });
        rowRecord[col] = value;
      }

      if (typeConfig.excludeRow?.(rowRecord)) {
        if (countAsSkipped) skipped++;
        return null;
      }

      return rowRecord;
    },
    50,
  );

  const rowRecords = mappedRows.filter((r) => r !== null);
  const derivedClassByManufacturer = buildDerivedComponentClassLookup(rowRecords, csvFile);
  for (const row of rowRecords) {
    if (!isDisplayDataCoreComponentClass(row.Class)) {
      row.Class = derivedClassByManufacturer.get(toComponentManufacturerKey(row, csvFile)) ?? row.Class;
    }
    rows.push(headers.map((header) => row[header] ?? ''));
  }

  if (!options.dryRun && rows.length > 0) {
    const csvContent = stringify([headers, ...rows]);
    await fs.writeFile(path.join(options.outputBase, csvFile), csvContent, 'utf8');
  }

  return { type: name, rows: rows.length, skipped, csvFile };
}

const scmdbComponentClassLookupCache = new Map<string, Promise<Map<string, string>>>();

async function loadScmdbComponentClassLookup({
  repoRoot,
  versionTag,
}: {
  repoRoot: string;
  versionTag: string;
}): Promise<Map<string, string>> {
  const cacheKey = `${repoRoot}|${versionTag}`;
  const existing = scmdbComponentClassLookupCache.get(cacheKey);
  if (existing) return existing;

  const promise = readScmdbComponentClassLookup(repoRoot, versionTag);
  scmdbComponentClassLookupCache.set(cacheKey, promise);
  return promise;
}

async function readScmdbComponentClassLookup(repoRoot: string, versionTag: string): Promise<Map<string, string>> {
  const classByRef = new Map<string, string>();
  const scmdbDir = path.join(repoRoot, 'csv', 'scmdb', versionTag);

  let entries: string[];
  try {
    entries = await fs.readdir(scmdbDir);
  } catch {
    return classByRef;
  }

  const craftingFile = entries
    .filter((entry) => /^crafting_items-.*\.json$/i.test(entry))
    .sort()
    .at(-1);
  if (!craftingFile) {
    return classByRef;
  }

  const data = JSON.parse(await fs.readFile(path.join(scmdbDir, craftingFile), 'utf8')) as {
    items?: Array<{ entityClass?: unknown; itemType?: unknown; componentClass?: unknown }>;
  };

  for (const item of data.items ?? []) {
    if (item.itemType !== 'shipcomponent') continue;
    const ref = normalizeSpaces(item.entityClass);
    const componentClass = normalizeSpaces(item.componentClass);
    if (ref && isDisplayDataCoreComponentClass(componentClass)) {
      classByRef.set(ref.toLowerCase(), componentClass);
    }
  }

  return classByRef;
}

function getDataCoreRecordForEntityClass(entityClass: string, relationships: DataCoreRelationshipIndex) {
  const normalized = normalizeDataCoreEntityClass(entityClass);
  if (!normalized) return undefined;
  return relationships.getRecordForEntityClass(normalized);
}

function resolveComponentManufacturerCode(
  record: DataCoreRecordNode | undefined,
  fallbackManufacturer: string,
  resolver: DataCoreManufacturerResolver | undefined,
): string {
  const graphManufacturerGuid = record ? graphGuidReference(record, ['Manufacturer', 'manufacturer']) : '';
  const graphManufacturer =
    graphManufacturerGuid && resolver ? resolver.getByRef(graphManufacturerGuid)?.code ?? '' : '';
  return graphManufacturer || resolveManufacturerCode(fallbackManufacturer, resolver);
}

function graphGuidReference(record: DataCoreRecordNode | undefined, attributes: string[]): string {
  if (!record || attributes.length === 0) return '';
  const expectedAttributes = new Set(attributes.map((attribute) => attribute.toLowerCase()));
  return (
    record.referencedGuidAttributes
      ?.filter((reference) => expectedAttributes.has(reference.attribute.toLowerCase()))
      .map((reference) => reference.value.trim())
      .find((value) => value !== '') ?? ''
  );
}

function getDataCoreGraphLocalizationKey(
  record: DataCoreRecordGraphLookup['graph']['records'][number] | undefined,
  role: 'name' | 'shortName' | 'description',
): string {
  const references = record?.localizationKeys ?? [];
  const attributePattern =
    role === 'name' ? /^(?:display)?name$/i : role === 'shortName' ? /^shortname$/i : /^(?:display)?description$/i;
  const keyPattern =
    role === 'name' ? /(?:^|_)name/i : role === 'shortName' ? /(?:^|_)short/i : /(?:^|_)desc(?:ription)?/i;

  return (
    references.find((reference) => attributePattern.test(reference.attribute) && isUsableLocalizationKey(reference.key))
      ?.key ??
    references.find((reference) => keyPattern.test(reference.key) && isUsableLocalizationKey(reference.key))?.key ??
    ''
  ).replace(/^@/, '');
}

function isUsableLocalizationKey(value: string): boolean {
  const normalized = localizationKey(value);
  return normalized !== '' && !/^LOC_/i.test(normalized);
}

function buildDerivedComponentClassLookup(rows: Array<Record<string, string>>, csvFile: string): Map<string, string> {
  const candidates = new Map<string, Set<string>>();

  for (const row of rows) {
    const cls = normalizeSpaces(row.Class);
    if (!isDisplayDataCoreComponentClass(cls)) continue;

    const key = toComponentManufacturerKey(row, csvFile);
    if (!key) continue;
    const values = candidates.get(key) ?? new Set<string>();
    values.add(cls);
    candidates.set(key, values);
  }

  const resolved = new Map<string, string>();
  for (const [key, values] of candidates) {
    if (values.size === 1) {
      resolved.set(key, [...values][0]);
    }
  }
  return resolved;
}

function toComponentManufacturerKey(row: Record<string, string>, csvFile: string): string {
  const componentType = csvFile.replace(/\.datacore\.csv$/i, '').toLowerCase();
  const manufacturer = getDataCoreComponentManufacturer(row);
  return componentType && manufacturer ? `${componentType}:${manufacturer}` : '';
}

function getDataCoreComponentManufacturer(row: Record<string, string>): string {
  const manufacturer = normalizeSpaces(row.Manufacturer).toUpperCase();
  if (manufacturer) {
    return manufacturer;
  }

  const entityClass = normalizeDataCoreEntityClass(row['Entity Class']);
  const parts = entityClass.split('_');
  return parts.length >= 2 ? parts[1].toUpperCase() : '';
}

const CORE_COMPONENT_CLASS_CSV_FILES = new Set([
  'cooler.datacore.csv',
  'powerplant.datacore.csv',
  'quantumdrive.datacore.csv',
  'shield.datacore.csv',
]);

const COMPONENT_CLASS_RECONCILE_CSV_FILES = new Set([...CORE_COMPONENT_CLASS_CSV_FILES, 'jumpdrive.datacore.csv']);

async function reconcileDataCoreComponentClasses(
  outputBase: string,
  selectedTypes: DataCoreTypeEntry[],
  dryRun?: boolean,
): Promise<void> {
  if (dryRun) return;

  const tables: Array<{ entry: DataCoreTypeEntry; rows: Array<Record<string, string>> }> = [];
  for (const entry of selectedTypes) {
    if (!COMPONENT_CLASS_RECONCILE_CSV_FILES.has(entry.csvFile)) continue;
    const filePath = path.join(outputBase, entry.csvFile);
    let csvContent: string;
    try {
      csvContent = await fs.readFile(filePath, 'utf8');
    } catch {
      continue;
    }
    const rows = parse(csvContent, { columns: true, skip_empty_lines: true }) as Array<Record<string, string>>;
    if (!rows[0] || !('Class' in rows[0])) continue;
    tables.push({ entry, rows });
  }

  const driveManufacturerClass = buildDriveManufacturerClassLookup(tables);
  const vehicleClass = buildVehicleComponentClassLookup(tables);

  for (const table of tables) {
    let changed = false;
    for (const row of table.rows) {
      if (isDisplayDataCoreComponentClass(row.Class)) continue;

      const resolvedClass =
        getDriveFamilyComponentClass(table.entry.csvFile, row, driveManufacturerClass) ??
        vehicleClass.get(getVehicleComponentToken(row['Entity Class'])) ??
        '';
      if (resolvedClass) {
        row.Class = resolvedClass;
        changed = true;
      }
    }

    if (changed) {
      await fs.writeFile(path.join(outputBase, table.entry.csvFile), stringify(table.rows, { header: true }), 'utf8');
    }
  }
}

function buildDriveManufacturerClassLookup(
  tables: Array<{ entry: DataCoreTypeEntry; rows: Array<Record<string, string>> }>,
): Map<string, string> {
  const candidates = new Map<string, Set<string>>();
  for (const table of tables) {
    if (table.entry.csvFile !== 'quantumdrive.datacore.csv') continue;
    for (const row of table.rows) {
      const cls = normalizeSpaces(row.Class);
      if (!isDisplayDataCoreComponentClass(cls)) continue;

      const manufacturer = getDataCoreComponentManufacturer(row);
      if (!manufacturer) continue;
      const values = candidates.get(manufacturer) ?? new Set<string>();
      values.add(cls);
      candidates.set(manufacturer, values);
    }
  }

  return uniqueValues(candidates);
}

function getDriveFamilyComponentClass(
  csvFile: string,
  row: Record<string, string>,
  driveManufacturerClass: Map<string, string>,
): string | undefined {
  if (csvFile !== 'jumpdrive.datacore.csv') return undefined;
  return driveManufacturerClass.get(getDataCoreComponentManufacturer(row));
}

function buildVehicleComponentClassLookup(
  tables: Array<{ entry: DataCoreTypeEntry; rows: Array<Record<string, string>> }>,
): Map<string, string> {
  const candidates = new Map<string, Set<string>>();
  for (const table of tables) {
    if (!CORE_COMPONENT_CLASS_CSV_FILES.has(table.entry.csvFile)) continue;
    for (const row of table.rows) {
      const cls = normalizeSpaces(row.Class);
      if (!isDisplayDataCoreComponentClass(cls)) continue;

      const token = getVehicleComponentToken(row['Entity Class']);
      if (!token) continue;
      const values = candidates.get(token) ?? new Set<string>();
      values.add(cls);
      candidates.set(token, values);
    }
  }

  return uniqueValues(candidates);
}

function getVehicleComponentToken(entityClass: string): string {
  const normalized = normalizeDataCoreEntityClass(entityClass)
    .replace(/_temp$/i, '')
    .replace(/_pirate$/i, '');
  const parts = normalized.split('_').filter(Boolean);
  if (parts.length < 3) return '';

  const last = parts.at(-1) ?? '';
  if (/^\d+$/.test(last) || /^s\d+$/i.test(last)) return '';
  return last;
}

function uniqueValues(candidates: Map<string, Set<string>>): Map<string, string> {
  const resolved = new Map<string, string>();
  for (const [key, values] of candidates) {
    if (values.size === 1) {
      resolved.set(key, [...values][0]);
    }
  }
  return resolved;
}

async function collectDataCoreTypeXmlCandidates(
  typeConfig: DataCoreItemTypeConfig,
  options: {
    xmlCacheDir: string;
    graph?: DataCoreRecordGraphLookup;
  },
): Promise<Array<{ xmlPath: string; countAsSkipped: boolean }>> {
  const candidates = new Map<string, { xmlPath: string; countAsSkipped: boolean }>();
  const addCandidate = (xmlPath: string, countAsSkipped: boolean) => {
    const existing = candidates.get(xmlPath);
    candidates.set(xmlPath, {
      xmlPath,
      countAsSkipped: Boolean(existing?.countAsSkipped || countAsSkipped),
    });
  };

  const recordFilters = Array.isArray(typeConfig.recordFilter) ? typeConfig.recordFilter : [typeConfig.recordFilter];
  for (const recordFilter of recordFilters) {
    for (const xmlFile of await collectDataCoreXmlFilesMatching(options.xmlCacheDir, recordFilter)) {
      addCandidate(xmlFile, true);
    }
  }

  if (typeConfig.recordSelector && typeConfig.includeStructuralDiscovery !== false && options.graph) {
    for (const record of options.graph.getByRootType('EntityClassDefinition')) {
      if (!isEntityRecordPath(record.path)) continue;
      addCandidate(path.join(options.xmlCacheDir, record.path), false);
    }
  }

  return [...candidates.values()].sort((a, b) => a.xmlPath.localeCompare(b.xmlPath));
}

function isEntityRecordPath(recordPath: string): boolean {
  return recordPath.replaceAll('\\', '/').toLowerCase().startsWith('libs/foundry/records/entities/');
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
      row.successReputationRewards,
      row.failureReputationRewards,
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
      row.blueprintRewardPoolGuids,
      row.blueprintRewards,
      row.requiredCompletedContractTags,
      row.completionTags,
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

async function writeContractHaulingSummaryCsv(
  rows: DataCoreContractHaulingSummaryRecord[],
  options: { outputBase: string; dryRun: boolean },
): Promise<DataCoreScrapeContractHaulingSummaryResult> {
  const csvFile = CONTRACT_HAULING_SUMMARY_CSV_FILE;
  const filePath = path.join(options.outputBase, csvFile);

  if (!options.dryRun) {
    const records = rows.map((row) => [
      row.generatorClass,
      row.contractId,
      row.contractDebugName,
      row.templateClass,
      row.descriptionKey,
      row.descriptionKeyRole,
      row.haulingSummary,
      row.recordGuid,
      row.recordPath,
    ]);

    const csvData = stringify(records, { header: true, columns: CONTRACT_HAULING_SUMMARY_HEADERS });
    await fs.writeFile(filePath, csvData, 'utf8');
  }

  return { rows: rows.length, csvFile };
}

async function writeContractGeneratorIntelCsv(
  rows: DataCoreContractGeneratorIntelRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeContractGeneratorIntelResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.generatorClass,
      row.contractId,
      row.contractDebugName,
      row.templateClass,
      row.descriptionKey,
      row.descriptionKeyRole,
      row.contractIntel,
      row.timeLimit,
      row.contractBuyInAmount,
      row.difficultyProfileClass,
      row.recordGuid,
      row.recordPath,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, CONTRACT_GENERATOR_INTEL_CSV_FILE),
      stringify([CONTRACT_GENERATOR_INTEL_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: CONTRACT_GENERATOR_INTEL_CSV_FILE };
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

async function writeContractTemplateHaulingCsv(
  rows: DataCoreContractTemplateHaulingOrderRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeContractTemplateHaulingResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.templateClass,
      row.objectiveDebugName,
      row.orderIndex,
      row.resourceGuid,
      row.resourceClass,
      row.resourceNameKey,
      row.minSCU,
      row.maxSCU,
      row.maxContainerSize,
      row.orderSummary,
      row.recordGuid,
      row.recordPath,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, CONTRACT_TEMPLATE_HAULING_CSV_FILE),
      stringify([CONTRACT_TEMPLATE_HAULING_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: CONTRACT_TEMPLATE_HAULING_CSV_FILE };
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
      row.controlledSubstanceJurisdictions,
      row.controlledSubstanceMaxScu,
      row.legalityWarningSource,
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

async function writeMissionContractIntelCsv(
  rows: DataCoreMissionContractIntelRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeMissionContractIntelResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.missionClass,
      row.descriptionKey,
      row.contractIntel,
      row.cooldown,
      row.reward,
      row.rewardCurrency,
      row.timeLimit,
      row.efficiency,
      row.missionDifficulty,
      row.recordGuid,
      row.recordPath,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, MISSION_CONTRACT_INTEL_CSV_FILE),
      stringify([MISSION_CONTRACT_INTEL_HEADERS, ...csvRows]),
      'utf8',
    );
  }

  return { rows: rows.length, csvFile: MISSION_CONTRACT_INTEL_CSV_FILE };
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

async function ensureDataCoreXmlCache(options: EnsureDataCoreXmlCacheOptions): Promise<DataCoreXmlCacheState> {
  const metadataPath = path.join(options.xmlCacheDir, '.metadata.json');
  const metadata = await readJsonFile<DataCoreXmlCacheMetadata>(metadataPath);
  const metadataMatches =
    !metadata && !options.dcbFingerprint
      ? true
      : metadata?.gameVersion === options.gameVersion && sameFingerprint(metadata?.dcb ?? null, options.dcbFingerprint);
  const cacheReusable =
    (options.cachedCount > 0 && metadataMatches && !options.forceExtract && !options.dcbRefreshed) ||
    (options.skipUnforge && options.cachedCount > 0);

  if (cacheReusable) {
    if (options.skipUnforge && (options.dcbRefreshed || !metadataMatches)) {
      options.onToolsLog?.(
        'WARNING: DataCore XML cache does not match the detected game files, but skipping unforge due to --skip-unforge flag. Using potentially stale XML cache.',
      );
    }
    options.onCacheHit?.(options.cachedCount, options.xmlCacheDir);
    return { xmlFileCount: options.cachedCount, reused: true };
  }

  const clearExisting =
    options.cachedCount > 0 && Boolean(options.forceExtract || options.dcbRefreshed || !metadataMatches);
  options.onCacheExtractStart?.(options.dcbPath, options.xmlCacheDir, clearExisting);
  const { xmlFileCount } = await options.extractXmlCache({
    dcbPath: options.dcbPath,
    xmlCacheDir: options.xmlCacheDir,
    clearExisting,
    runUnforge: async (cacheDir) => {
      try {
        const actualP4kPath = path.join(options.liveDir, 'Data.p4k');
        await runToolAsync(options.tools.unp4k, [actualP4kPath, '*Subsumption/Missions/PU/Missions/*.xml'], {
          cwd: cacheDir,
          stdio: 'ignore',
        });
      } catch (err) {
        options.onToolsLog?.(`Failed to extract Subsumption XMLs: ${err}`);
      }
      await runToolAsync(options.tools.unforge, [cacheDir], { stdio: 'ignore' });
    },
    onProgress: (count) => options.onCacheExtractProgress?.(count),
  });
  await writeJsonFile(metadataPath, {
    gameVersion: options.gameVersion,
    dcb: options.dcbFingerprint,
  } satisfies DataCoreXmlCacheMetadata);
  options.onCacheExtractComplete?.(xmlFileCount);

  return { xmlFileCount, reused: false };
}

function createRawFactProgressReporter(
  options: Pick<RunDatacoreScrapeOptions, 'onRawFactStart' | 'onRawFactProgress'>,
  slug: string,
): (current: number, total: number) => void {
  let started = false;

  return (current, total) => {
    if (!started) {
      options.onRawFactStart?.(slug, total);
      started = true;
    }
    options.onRawFactProgress?.(slug, current, total);
  };
}

async function resolveField(
  $: ReturnType<typeof loadXml>,
  spec: DataCoreFieldSelector,
  row: Record<string, string>,
  context: {
    graph?: DataCoreRecordGraphLookup;
    record?: DataCoreRecordNode;
    relationships: DataCoreRelationshipIndex;
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
    record?: DataCoreRecordNode;
    relationships: DataCoreRelationshipIndex;
    xmlCacheDir: string;
    referencedXmlCache: Map<string, ReturnType<typeof loadXml>>;
  },
): Promise<ReturnType<typeof loadXml> | undefined> {
  if (!context.graph) return undefined;

  let source = $;
  let sourceRecord = context.record;
  for (const step of Array.isArray(ref) ? ref : [ref]) {
    const record = resolveReferencedRecord(source, sourceRecord, step, context.graph, context.relationships);
    if (!record) return undefined;

    const cached = context.referencedXmlCache.get(record.path);
    if (cached) {
      source = cached;
      sourceRecord = record;
      continue;
    }

    const xml = await fs.readFile(path.join(context.xmlCacheDir, record.path), 'utf8');
    source = loadXml(xml);
    sourceRecord = record;
    context.referencedXmlCache.set(record.path, source);
  }

  return source;
}

function resolveReferencedRecord(
  source: ReturnType<typeof loadXml>,
  sourceRecord: DataCoreRecordNode | undefined,
  step: DataCoreFieldReferenceSelector,
  graph: DataCoreRecordGraphLookup,
  relationships: DataCoreRelationshipIndex,
): ReturnType<DataCoreRecordGraphLookup['getByRef']> {
  const candidates = [step, ...(Array.isArray(step.fallback) ? step.fallback : step.fallback ? [step.fallback] : [])];

  for (const candidate of candidates) {
    const graphReferenceValue = uniqueGraphGuidReference(sourceRecord, candidate.graphAttribute);
    if (graphReferenceValue) {
      const record =
        candidate.by === 'entityClass'
          ? relationships.getRecordForEntityClass(graphReferenceValue)
          : graph.getByRef(graphReferenceValue);
      if (record) return record;
    }

    const referenceValue = source(candidate.selector).first().attr(candidate.attr)?.trim();
    if (!referenceValue) continue;

    const record =
      candidate.by === 'entityClass'
        ? relationships.getRecordForEntityClass(referenceValue)
        : graph.getByRef(referenceValue);
    if (record) return record;
  }

  return undefined;
}

function uniqueGraphGuidReference(record: DataCoreRecordNode | undefined, attribute: string | undefined): string {
  if (!record || !attribute) return '';
  const values = [
    ...new Set(
      record.referencedGuidAttributes
        ?.filter((reference) => reference.attribute.toLowerCase() === attribute.toLowerCase())
        .map((reference) => reference.value.trim())
        .filter(Boolean) ?? [],
    ),
  ];
  return values.length === 1 ? values[0] : '';
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
  if (!trimmed || /^@?LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i.test(trimmed)) return '';
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}

function resolveManufacturerCode(manufacturer: string, resolver: DataCoreManufacturerResolver | undefined): string {
  const trimmed = manufacturer.trim();
  if (!trimmed) return '';
  return resolver?.resolve(trimmed)?.code || trimmed;
}

async function writeBlueprintPoolsCsv(
  rows: import('../../sources/datacore/types').DataCoreBlueprintPoolRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeBlueprintPoolsResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [row.poolClass, row.blueprintGuids, row.ref, row.path]);
    await fs.writeFile(
      path.join(options.outputBase, 'blueprint-pools.datacore.csv'),
      stringify([['PoolClass', 'BlueprintGuids', 'Ref', 'Path'], ...csvRows]),
      'utf8',
    );
  }
  return { rows: rows.length, csvFile: 'blueprint-pools.datacore.csv' };
}

async function writeCraftingBlueprintsCsv(
  rows: import('../../sources/datacore/types').DataCoreCraftingBlueprintRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeCraftingBlueprintsResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [
      row.blueprintClass,
      row.targetEntityClassGuid,
      row.targetEntityClass,
      row.targetItemNameKey,
      row.recipeCosts,
      row.ref,
      row.path,
    ]);
    await fs.writeFile(
      path.join(options.outputBase, 'crafting-blueprints.datacore.csv'),
      stringify([
        [
          'BlueprintClass',
          'TargetEntityClassGuid',
          'TargetEntityClass',
          'TargetItemNameKey',
          'RecipeCosts',
          'Ref',
          'Path',
        ],
        ...csvRows,
      ]),
      'utf8',
    );
  }
  return { rows: rows.length, csvFile: 'crafting-blueprints.datacore.csv' };
}

async function writeMaterialLocalizationCsv(
  rows: import('../../sources/datacore/types').DataCoreMaterialLocalizationRecord[],
  options: { outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeMaterialLocalizationsResult> {
  if (!options.dryRun) {
    const csvRows = rows.map((row) => [row.resourceGuid, row.localizationKey]);
    await fs.writeFile(
      path.join(options.outputBase, 'material-localizations.datacore.csv'),
      stringify([['ResourceGuid', 'LocalizationKey'], ...csvRows]),
      'utf8',
    );
  }
  return { rows: rows.length, csvFile: 'material-localizations.datacore.csv' };
}
