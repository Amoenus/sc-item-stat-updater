import type { SourceDataset } from '../../pipeline/types';

/**
 * Normalized DataCore component record produced from unforged game-file XML.
 *
 * The common fields are shared across component families; additional
 * type-specific stat columns are kept as string values keyed by their CSV
 * header names so existing item planners can migrate one family at a time.
 */
export interface DataCoreComponentRecord extends Record<string, string> {
  'Entity Class': string;
  'Name Key': string;
  'Short Name Key': string;
  'Description Key': string;
  Manufacturer: string;
  Size: string;
  Grade: string;
  Class: string;
  Health: string;
}

export type DataCoreComponentDataset = SourceDataset<DataCoreComponentRecord> & {
  source: 'datacore';
};

export interface DataCoreCommodityRecord {
  ref: string;
  path: string;
  entityClass: string;
  nameKey: string;
  descriptionKey: string;
  displayNameKey: string;
  displayDescriptionKey: string;
  displayTypeKey: string;
  typeGuid: string;
  subtypeGuid: string;
  cargoOccupancyUnit: string;
  cargoOccupancyValue: string;
  cargoOccupancySCU: string;
  boxable: string;
  isUnrefinedElement: string;
  isRaw: string;
  isRefined: string;
}

export type DataCoreCommodityDataset = SourceDataset<DataCoreCommodityRecord> & {
  source: 'datacore';
};

export interface DataCoreVehicleRecord {
  ref: string;
  path: string;
  entityClass: string;
  vehicleNameKey: string;
  vehicleDescriptionKey: string;
  manufacturerGuid: string;
  manufacturerCode: string;
  manufacturerNameKey: string;
  movementClass: string;
  vehicleDefinition: string;
  modification: string;
  careerKey: string;
  careerGuid: string;
  roleKey: string;
  roleGuid: string;
  crewSize: string;
  hullDamageNormalization: string;
  allowSoftDestruction: string;
  dogfightEnabled: string;
  isGravlevVehicle: string;
  inventoryContainerGuid: string;
}

export type DataCoreVehicleDataset = SourceDataset<DataCoreVehicleRecord> & {
  source: 'datacore';
};

export interface DataCoreMissionLocalizationRecord {
  localizationKey: string;
  localizationRole: string;
  attribute: string;
  rootType: string;
  entityClass: string;
  ref: string;
  path: string;
}

export interface DataCoreMissionBrokerRecord {
  missionClass: string;
  titleKey: string;
  titleHudKey: string;
  descriptionKey: string;
  missionGiverKey: string;
  commsChannelNameKey: string;
  missionModule: string;
  missionTypeGuid: string;
  missionTypeClass: string;
  ownerGuid: string;
  ownerClass: string;
  missionGiverRecordGuid: string;
  missionGiverRecordClass: string;
  locationMissionAvailableGuid: string;
  locationMissionAvailableClass: string;
  missionDifficulty: string;
  reward: string;
  rewardMax: string;
  rewardPlusBonuses: string;
  currencyType: string;
  missionCompletionTime: string;
  missionAutoEnd: string;
  missionResultAfterTimerEnd: string;
  remainingTimeToShowTimer: string;
  initiallyActive: string;
  notifyOnAvailable: string;
  showAsOffer: string;
  requestOnly: string;
  lawfulMission: string;
  maxInstances: string;
  maxPlayersPerInstance: string;
  maxInstancesPerPlayer: string;
  canBeShared: string;
  onceOnly: string;
  tutorial: string;
  availableInPrison: string;
  failIfSentToPrison: string;
  failIfBecameCriminal: string;
  failIfLeavePrison: string;
  respawnTime: string;
  respawnTimeVariation: string;
  instanceHasLifeTime: string;
  showLifeTimeInMobiGlas: string;
  instanceLifeTime: string;
  instanceLifeTimeVariation: string;
  canReacceptAfterAbandoning: string;
  abandonedCooldownTime: string;
  abandonedCooldownTimeVariation: string;
  canReacceptAfterFailing: string;
  hasPersonalCooldown: string;
  personalCooldownTime: string;
  personalCooldownTimeVariation: string;
  recordGuid: string;
  recordPath: string;
}

export interface DataCoreMissionContractIntelRecord {
  missionClass: string;
  descriptionKey: string;
  contractIntel: string;
  cooldown: string;
  reward: string;
  rewardCurrency: string;
  timeLimit: string;
  efficiency: string;
  missionDifficulty: string;
  recordGuid: string;
  recordPath: string;
}

export interface DataCoreContractGeneratorRecord {
  generatorClass: string;
  handlerType: string;
  handlerDebugName: string;
  handlerNotForRelease: string;
  handlerWorkInProgress: string;
  factionReputationGuid: string;
  reputationScopeGuid: string;
  contractSection: string;
  contractId: string;
  contractDebugName: string;
  contractNotForRelease: string;
  contractWorkInProgress: string;
  templateGuid: string;
  templateClass: string;
  titleKey: string;
  descriptionKey: string;
  contractorKey: string;
  titleVariantKeys: string;
  descriptionVariantKeys: string;
  stringParamOverrides: string;
  locationTagGuids: string;
  locationTagClasses: string;
  maxInstances: string;
  maxInstancesPerPlayer: string;
  respawnTime: string;
  respawnTimeVariation: string;
  instanceLifeTime: string;
  instanceLifeTimeVariation: string;
  contractBuyInAmount: string;
  timeToComplete: string;
  difficultyProfileGuid: string;
  difficultyProfileClass: string;
  mechanicalSkill: string;
  mentalLoad: string;
  riskOfLoss: string;
  gameKnowledge: string;
  recordGuid: string;
  recordPath: string;
}

export interface DataCoreContractGeneratorIntelRecord {
  generatorClass: string;
  contractId: string;
  contractDebugName: string;
  templateClass: string;
  descriptionKey: string;
  descriptionKeyRole: string;
  contractIntel: string;
  timeLimit: string;
  contractBuyInAmount: string;
  difficultyProfileClass: string;
  recordGuid: string;
  recordPath: string;
}

export interface DataCoreContractTemplateRecord {
  templateClass: string;
  contractClassType: string;
  ownerGuid: string;
  ownerClass: string;
  displayTypeGuid: string;
  displayTypeClass: string;
  illegal: string;
  showLifeTimeInMobiGlas: string;
  preShowObjectives: string;
  hasCompleteButton: string;
  handlesAbandonRequest: string;
  canBeShared: string;
  displayAlliedMarkers: string;
  onlyOwnerCanComplete: string;
  failIfSentToPrison: string;
  failIfBecameCriminal: string;
  failIfLeavePrison: string;
  missionCompletionTime: string;
  missionAutoEnd: string;
  missionResultAfterTimerEnd: string;
  remainingTimeToShowTimer: string;
  objectiveCount: string;
  missionPropertyCount: string;
  objectiveHandlerTypes: string;
  objectiveHandlerModules: string;
  objectiveDisplayKeys: string;
  travelObjectiveKeys: string;
  returnObjectiveKeys: string;
  overrideMissionDetailsKeys: string;
  navPointNameKeys: string;
  stringHashKeys: string;
  locationTagGuids: string;
  locationTagClasses: string;
  recordGuid: string;
  recordPath: string;
}

export interface DataCoreContractTemplateHaulingOrderRecord {
  templateClass: string;
  objectiveDebugName: string;
  orderIndex: string;
  resourceGuid: string;
  resourceClass: string;
  resourceNameKey: string;
  minSCU: string;
  maxSCU: string;
  maxContainerSize: string;
  orderSummary: string;
  recordGuid: string;
  recordPath: string;
}

export interface DataCoreFactionRecord {
  ref: string;
  path: string;
  factionClass: string;
  nameKey: string;
  descriptionKey: string;
  defaultReaction: string;
  factionType: string;
  ableToArrest: string;
  policesLawfulTrespass: string;
  policesCriminality: string;
  noLegalRights: string;
  factionReputationGuid: string;
  factionReputationClass: string;
  factionReputationPath: string;
  reputationDisplayNameKey: string;
  reputationDescriptionKey: string;
  reputationHeadquartersKey: string;
  reputationFoundedKey: string;
  reputationLeadershipKey: string;
  reputationAreaKey: string;
  reputationFocusKey: string;
  reputationLawful: string;
  alliedFactionGuids: string;
  enemyFactionGuids: string;
}

export type DataCoreFactionDataset = SourceDataset<DataCoreFactionRecord> & {
  source: 'datacore';
};

export interface DataCoreManufacturerRecord {
  ref: string;
  path: string;
  manufacturerClass: string;
  code: string;
  nameKey: string;
  shortNameKey: string;
  descriptionKey: string;
  logo: string;
  logoFullColor: string;
  logoSimplifiedWhite: string;
  dashboardCanvasConfigGuid: string;
  buildingBlocksStyleGuid: string;
  audioManufacturerTagGuid: string;
  lightAmplificationGuid: string;
}

export type DataCoreManufacturerDataset = SourceDataset<DataCoreManufacturerRecord> & {
  source: 'datacore';
};

export interface DataCoreMiningElementRecord {
  ref: string;
  path: string;
  elementClass: string;
  elementName: string;
  materialName: string;
  inferredDescriptionKey: string;
  resourceTypeGuid: string;
  instability: string;
  resistance: string;
  optimalWindowMidpoint: string;
  optimalWindowRandomness: string;
  optimalWindowThinness: string;
  explosionMultiplier: string;
  clusterFactor: string;
}

export type DataCoreMiningElementDataset = SourceDataset<DataCoreMiningElementRecord> & {
  source: 'datacore';
};

export interface DataCoreMiningCompositionPartRecord {
  ref: string;
  path: string;
  compositionClass: string;
  depositNameKey: string;
  minimumDistinctElements: string;
  partIndex: string;
  mineableElementGuid: string;
  mineableElementClass: string;
  mineableElementName: string;
  minPercentage: string;
  maxPercentage: string;
  probability: string;
  curveExponent: string;
  qualityScale: string;
}

export type DataCoreMiningCompositionDataset = SourceDataset<DataCoreMiningCompositionPartRecord> & {
  source: 'datacore';
};

export interface DataCoreMineableEntityRecord {
  ref: string;
  path: string;
  entityClass: string;
  compositionGuid: string;
  compositionClass: string;
  globalParamsGuid: string;
  globalParamsClass: string;
  audioParamsGuid: string;
  audioParamsClass: string;
  densityClassGuid: string;
  densityClass: string;
  filledFactor: string;
  glowCurvePower: string;
  glowLerpSpeed: string;
  allowAutoRespawning: string;
}

export interface DataCoreMiningRockSignatureRecord {
  ref: string;
  path: string;
  entityClass: string;
  variantFamily: 'asteroid' | 'surface' | 'fps' | 'groundvehicle';
  rarity: string;
  elementToken: string;
  scanSignature: string;
}

export type DataCoreMiningRockSignatureDataset = SourceDataset<DataCoreMiningRockSignatureRecord> & {
  source: 'datacore';
};

export interface DataCoreMiningQualityQuantizationRecord {
  ref: string;
  path: string;
  quantizationClass: string;
  elementToken: string;
  qualityBands: string;
  bandRanges: string;
}

export type DataCoreMiningQualityQuantizationDataset = SourceDataset<DataCoreMiningQualityQuantizationRecord> & {
  source: 'datacore';
};

export type DataCoreMineableEntityDataset = SourceDataset<DataCoreMineableEntityRecord> & {
  source: 'datacore';
};

export interface DataCoreMiningClusteringParamRecord {
  ref: string;
  path: string;
  clusteringClass: string;
  probabilityOfClustering: string;
  paramIndex: string;
  relativeProbability: string;
  minSize: string;
  maxSize: string;
  minProximity: string;
  maxProximity: string;
}

export type DataCoreMiningClusteringDataset = SourceDataset<DataCoreMiningClusteringParamRecord> & {
  source: 'datacore';
};

export interface DataCoreMiningHarvestablePresetRecord {
  ref: string;
  path: string;
  harvestablePresetClass: string;
  harvestableEntityGuid: string;
  harvestableEntityClass: string;
  harvestableEntityPath: string;
  respawnInSlotTime: string;
  specialHarvestableString: string;
}

export type DataCoreMiningHarvestablePresetDataset = SourceDataset<DataCoreMiningHarvestablePresetRecord> & {
  source: 'datacore';
};

export interface DataCoreMiningHarvestableSetupRecord {
  ref: string;
  path: string;
  setupClass: string;
  respawnInSlotTime: string;
  specialHarvestableString: string;
  harvestConditionTypes: string;
  healthRatio: string;
  includeAttachedChildren: string;
  allInteractionsClearSpawnPoint: string;
  movementDistance: string;
  despawnTimeSeconds: string;
  additionalWaitForNearbyPlayersSeconds: string;
  minScale: string;
  maxScale: string;
  terrainNormalAlignment: string;
  minZOffset: string;
  maxZOffset: string;
  minSlope: string;
  maxSlope: string;
  minElevation: string;
  maxElevation: string;
  localRotationOffset: string;
  rotationRange: string;
  positionOffset: string;
}

export type DataCoreMiningHarvestableSetupDataset = SourceDataset<DataCoreMiningHarvestableSetupRecord> & {
  source: 'datacore';
};

export interface DataCoreMiningSubHarvestableConfigRecord {
  ref: string;
  path: string;
  configClass: string;
  configType: string;
  taggedConfigName: string;
  tagGuids: string;
  initialSlotsProbability: string;
  configRespawnTimeMultiplier: string;
  slotIndex: string;
  harvestableGuid: string;
  harvestableClass: string;
  harvestablePath: string;
  harvestableEntityGuid: string;
  harvestableEntityClass: string;
  harvestableEntityPath: string;
  harvestableSetupGuid: string;
  harvestableSetupClass: string;
  relativeProbability: string;
  deepestRelativeProbability: string;
  harvestableRespawnTimeMultiplier: string;
  geometryTags: string;
  referencedConfigGuid: string;
  referencedConfigClass: string;
  referencedConfigPath: string;
}

export type DataCoreMiningSubHarvestableConfigDataset = SourceDataset<DataCoreMiningSubHarvestableConfigRecord> & {
  source: 'datacore';
};

export interface DataCoreMiningQualityDistributionRecord {
  ref: string;
  path: string;
  distributionClass: string;
  distributionType: string;
  mineableFamily: string;
  locationGuid: string;
  locationClass: string;
  locationPath: string;
  minQuality: string;
  maxQuality: string;
  mean: string;
  stddev: string;
}

export type DataCoreMiningQualityDistributionDataset = SourceDataset<DataCoreMiningQualityDistributionRecord> & {
  source: 'datacore';
};

export interface DataCoreMiningDensityOverrideRecord {
  ref: string;
  path: string;
  overrideClass: string;
  densityClassGuid: string;
  densityClass: string;
  densityClassPath: string;
  lifetimeDays: string;
  lifetimeHours: string;
  lifetimeMinutes: string;
  lifetimeSeconds: string;
  lifetimeTotalSeconds: string;
}

export type DataCoreMiningDensityOverrideDataset = SourceDataset<DataCoreMiningDensityOverrideRecord> & {
  source: 'datacore';
};

export interface DataCoreMiningLocationLabelRecord {
  ref: string;
  path: string;
  locationClass: string;
  sourceReason: string;
  nameKey: string;
  descriptionKey: string;
  callout1Key: string;
  callout2Key: string;
  callout3Key: string;
  typeGuid: string;
  parentGuid: string;
  parentClass: string;
  parentPath: string;
  locationHierarchyTag: string;
  navIcon: string;
  size: string;
  hideInStarmap: string;
  hideInWorld: string;
  isScannable: string;
  blockTravel: string;
  arrivalRadius: string;
  adoptionRadius: string;
  setEntityLocationOnEnter: string;
  exposeForPlayerCreatedMissions: string;
}

export type DataCoreMiningLocationLabelDataset = SourceDataset<DataCoreMiningLocationLabelRecord> & {
  source: 'datacore';
};

export interface DataCoreLocationLabelRecord {
  ref: string;
  path: string;
  locationClass: string;
  nameKey: string;
  descriptionKey: string;
  callout1Key: string;
  callout2Key: string;
  callout3Key: string;
  typeGuid: string;
  parentGuid: string;
  parentClass: string;
  parentPath: string;
  affiliationGuid: string;
  affiliationClass: string;
  affiliationPath: string;
  affiliationNameKey: string;
  jurisdictionGuid: string;
  jurisdictionClass: string;
  jurisdictionPath: string;
  jurisdictionNameKey: string;
  respawnLocationType: string;
  locationHierarchyTag: string;
  navIcon: string;
  size: string;
  hideInStarmap: string;
  hideInWorld: string;
  hideWhenInAdoptionRadius: string;
  onlyShowWhenParentSelected: string;
  overrideShowInAllZones: string;
  overridePermanent: string;
  minimumDisplaySize: string;
  blockTravel: string;
  isScannable: string;
  showOrbitLine: string;
  useHoloMaterial: string;
  noAutoBodyRecovery: string;
  arrivalRadius: string;
  adoptionRadius: string;
  setEntityLocationOnEnter: string;
  exposeForPlayerCreatedMissions: string;
  starMapGeomPath: string;
  starMapMaterialPath: string;
  starMapShapePath: string;
  locationImagePath: string;
}

export type DataCoreLocationLabelDataset = SourceDataset<DataCoreLocationLabelRecord> & {
  source: 'datacore';
};

export interface DataCoreMiningParamRecord {
  ref: string;
  path: string;
  paramType: string;
  paramClass: string;
  highlightOccludedAlpha: string;
  highlightOutlineWidth: string;
  highlightDistantMineablesRange: string;
  showChildRockRadarIcon: string;
  scalePowerGraphMin: string;
  noProgressHintTime: string;
  noProgressHintPower: string;
  fractureDoneFeedbackDuration: string;
  maxScanRaycastDistance: string;
  highlightColor: string;
  highlightColorAbsorbable: string;
  highlightColorDistant: string;
  highlightColorDistantScanned: string;
  cameraShakeEnabled: string;
  cameraShakeTimePeriod: string;
  cameraShakeFrequencyNoiseFactor: string;
  cameraShakeTranslationNoise: string;
  cameraShakeRotationNoise: string;
  cameraShakeMaxUnderOptimalWindow: string;
  cameraShakeInOptimalWindow: string;
  cameraShakeMinInDangerWindow: string;
  cameraShakeChangeLerpSpeed: string;
  cameraShakeOffsetPosition: string;
  cameraShakeOffsetAngle: string;
  blockThrottleChangeWhenNotFiring: string;
  throttleResetOnStopFire: string;
  throttleChangePerAction: string;
  throttleAccPeriod: string;
  throttleAccFactor: string;
  throttleHoldAccFactor: string;
  throttleRtpc: string;
  powerCapacityPerMass: string;
  decayPerMass: string;
  optimalWindowSize: string;
  optimalWindowFactor: string;
  resistanceCurveFactor: string;
  optimalWindowThinnessCurveFactor: string;
  optimalWindowMaxSize: string;
  controlledBreakingFillRate: string;
  controlledBreakingFillRateDanger: string;
  controlledBreakingDecayRate: string;
  dangerBreakingFillRate: string;
  dangerBreakingFillRateExponent: string;
  dangerBreakingDecayRate: string;
  absorbableVolumeThreshold: string;
  childRockInvulnerabilityTime: string;
  cSCUPerVolume: string;
  defaultMass: string;
  modifierPersistenceTime: string;
  childRockLifeTimer: string;
  childRockZeroGDamping: string;
  terrainFactorStaticThreshold: string;
  showExplosionFXForSurplusChild: string;
  childRockInactivityLifetime: string;
  gadgetDetachThreshold: string;
  gadgetDestroyThreshold: string;
  dangerToGadgetDamage: string;
  wasteResourceType: string;
  instabilityWavePeriod: string;
  instabilityWaveVariance: string;
  instabilityCurveFactor: string;
  dangerPoolFactor: string;
  explosionDefaultVolume: string;
  hitHistoryWindow: string;
  standardDeviationMultiplier: string;
  timeExponent: string;
  minDeviation: string;
  extractionMagnitude: string;
  maxEffectOnInstability: string;
  fractureParticleEffect: string;
  explosionParticleEffect: string;
  centerRockDestroyParticleEffect: string;
  fullyExtractedRockParticleEffect: string;
  mineablePowerIncreasingFallOff: string;
  mineablePowerLevelRtpc: string;
  mineableDangerBreakingRtpc: string;
  mineableOptimalBreakingRtpc: string;
  mineableMassRtpc: string;
  mineableCrackGlowStrengthRtpc: string;
  miningStartTrigger: string;
  miningStopTrigger: string;
  goodFracturedTrigger: string;
  badFracturedTrigger: string;
  extractedTrigger: string;
  clusterDetectionRadius: string;
  clusterUpperObjectCountDGS: string;
  clusterUpperObjectCountPersistence: string;
  clusterPersistenceTimeout: string;
  resetLifetimeOnMove: string;
  entityIdleBuryOnly: string;
}

export type DataCoreMiningParamDataset = SourceDataset<DataCoreMiningParamRecord> & {
  source: 'datacore';
};

export interface DataCoreMiningProviderPresetRecord {
  ref: string;
  path: string;
  providerClass: string;
  system: string;
  location: string;
  groupName: string;
  groupProbability: string;
  entryIndex: string;
  harvestableGuid: string;
  harvestableClass: string;
  harvestablePath: string;
  harvestableEntityGuid: string;
  harvestableEntityClass: string;
  harvestableEntityPath: string;
  harvestableSetupGuid: string;
  harvestableSetupClass: string;
  compositionGuid: string;
  compositionClass: string;
  globalParamsGuid: string;
  audioParamsGuid: string;
  filledFactor: string;
  clusteringGuid: string;
  clusteringClass: string;
  relativeProbability: string;
  geometryTags: string;
}

export type DataCoreMiningProviderPresetDataset = SourceDataset<DataCoreMiningProviderPresetRecord> & {
  source: 'datacore';
};

export interface DataCoreLocalizationReference {
  attribute: string;
  key: string;
}

export interface DataCoreRecordNode {
  path: string;
  ref: string;
  rootTag: string;
  rootType: string;
  entityClass: string;
  localizationKeys: DataCoreLocalizationReference[];
  referencedGuids: string[];
}

export interface DataCoreRecordGraph {
  source: 'datacore-record-graph';
  recordCount: number;
  records: DataCoreRecordNode[];
  indexes: {
    byRef: Record<string, string>;
    byPath: Record<string, number>;
    byRootType: Record<string, string[]>;
    byEntityClass: Record<string, string[]>;
    byLocalizationKey: Record<string, string[]>;
    byReferencedGuid: Record<string, string[]>;
  };
}

export interface DataCoreRecordGraphLookup {
  readonly graph: DataCoreRecordGraph;
  getByRef(ref: string): DataCoreRecordNode | undefined;
  getByPath(recordPath: string): DataCoreRecordNode | undefined;
  getByRootType(rootType: string): DataCoreRecordNode[];
  getByEntityClass(entityClass: string): DataCoreRecordNode[];
  getByLocalizationKey(key: string): DataCoreRecordNode[];
  getByReferencedGuid(guid: string): DataCoreRecordNode[];
  getByPathPrefix(pathPrefix: string): DataCoreRecordNode[];
}
