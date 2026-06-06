import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import type { DataCoreMiningParamRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_MINEABLE_ENTITY_PATH_PREFIX = 'libs/foundry/records/entities/mineable';
const PARAM_ROOT_TYPES = new Set([
  'MiningControllerGlobalParams',
  'MiningGlobalParams',
  'MiningAudioParams',
  'MiningLaserGlobalParams',
]);

export interface ExtractDataCoreMiningParamsOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  mineableEntityPathPrefix?: string;
}

export async function extractDataCoreMiningParams(
  options: ExtractDataCoreMiningParamsOptions,
): Promise<DataCoreMiningParamRecord[]> {
  const referencedDensityRefs = await collectMineableDensityRefs(options);
  const records = options.graph.graph.records
    .filter((record) => PARAM_ROOT_TYPES.has(record.rootType) || referencedDensityRefs.has(record.ref))
    .sort((a, b) => paramSortKey(a).localeCompare(paramSortKey(b)));
  const rows: DataCoreMiningParamRecord[] = [];

  for (const record of records) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore mining param XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const root = $(':root').first();
    if (!root.length) continue;

    const row = emptyRow(record);
    if (record.rootType === 'MiningControllerGlobalParams') {
      const cameraShake = $('cameraShakeConfig').first();
      Object.assign(row, {
        highlightOccludedAlpha: root.attr('highlightOccludedAlpha') ?? '',
        highlightOutlineWidth: root.attr('highlightOutlineWidth') ?? '',
        highlightDistantMineablesRange: root.attr('highlightDistantMineablesRange') ?? '',
        showChildRockRadarIcon: root.attr('showChildRockRadarIcon') ?? '',
        scalePowerGraphMin: root.attr('scalePowerGraphMin') ?? '',
        noProgressHintTime: root.attr('noProgressHintTime') ?? '',
        noProgressHintPower: root.attr('noProgressHintPower') ?? '',
        fractureDoneFeedbackDuration: root.attr('fractureDoneFeedbackDuration') ?? '',
        maxScanRaycastDistance: root.attr('maxScanRaycastDistance') ?? '',
        highlightColor: rgba($('highlightColor').first()),
        highlightColorAbsorbable: rgba($('highlightColorAbsorbable').first()),
        highlightColorDistant: rgba($('highlightColorDistant').first()),
        highlightColorDistantScanned: rgba($('highlightColorDistantScanned').first()),
        cameraShakeEnabled: cameraShake.attr('enabled') ?? '',
        cameraShakeTimePeriod: cameraShake.attr('timePeriod') ?? '',
        cameraShakeFrequencyNoiseFactor: cameraShake.attr('frequencyNoiseFactor') ?? '',
        cameraShakeTranslationNoise: cameraShake.attr('translationNoise') ?? '',
        cameraShakeRotationNoise: cameraShake.attr('rotationNoise') ?? '',
        cameraShakeMaxUnderOptimalWindow: cameraShake.attr('maxShakeWhenUnderOptimalWindow') ?? '',
        cameraShakeInOptimalWindow: cameraShake.attr('shakeInOptimalWindow') ?? '',
        cameraShakeMinInDangerWindow: cameraShake.attr('minShakeInDangerWindow') ?? '',
        cameraShakeChangeLerpSpeed: cameraShake.attr('shakeChangeLerpSpeed') ?? '',
        cameraShakeOffsetPosition: xyz(cameraShake.find('> offsetPosition').first()),
        cameraShakeOffsetAngle: xyz(cameraShake.find('> offsetAngle').first()),
      });
    } else if (record.rootType === 'MiningLaserGlobalParams') {
      Object.assign(row, {
        blockThrottleChangeWhenNotFiring: root.attr('blockThrottleChangeWhenNotFiring') ?? '',
        throttleResetOnStopFire: root.attr('throttleResetOnStopFire') ?? '',
        throttleChangePerAction: root.attr('throttleChangePerAction') ?? '',
        throttleAccPeriod: root.attr('throttleAccPeriod') ?? '',
        throttleAccFactor: root.attr('throttleAccFactor') ?? '',
        throttleHoldAccFactor: root.attr('throttleHoldAccFactor') ?? '',
        throttleRtpc: $('throttleRTPC').first().attr('rtpc') ?? '',
      });
    } else if (record.rootType === 'MiningGlobalParams') {
      Object.assign(row, {
        powerCapacityPerMass: root.attr('powerCapacityPerMass') ?? '',
        decayPerMass: root.attr('decayPerMass') ?? '',
        optimalWindowSize: root.attr('optimalWindowSize') ?? '',
        optimalWindowFactor: root.attr('optimalWindowFactor') ?? '',
        resistanceCurveFactor: root.attr('resistanceCurveFactor') ?? '',
        optimalWindowThinnessCurveFactor: root.attr('optimalWindowThinnessCurveFactor') ?? '',
        optimalWindowMaxSize: root.attr('optimalWindowMaxSize') ?? '',
        controlledBreakingFillRate: root.attr('controlledBreakingFillRate') ?? '',
        controlledBreakingFillRateDanger: root.attr('controlledBreakingFillRateDanger') ?? '',
        controlledBreakingDecayRate: root.attr('controlledBreakingDecayRate') ?? '',
        dangerBreakingFillRate: root.attr('dangerBreakingFillRate') ?? '',
        dangerBreakingFillRateExponent: root.attr('dangerBreakingFillRateExponent') ?? '',
        dangerBreakingDecayRate: root.attr('dangerBreakingDecayRate') ?? '',
        absorbableVolumeThreshold: root.attr('absorbableVolumeThreshold') ?? '',
        childRockInvulnerabilityTime: root.attr('childRockInvulnerabilityTime') ?? '',
        cSCUPerVolume: root.attr('cSCUPerVolume') ?? '',
        defaultMass: root.attr('defaultMass') ?? '',
        modifierPersistenceTime: root.attr('modifierPersistenceTime') ?? '',
        childRockLifeTimer: root.attr('childRockLifeTimer') ?? '',
        childRockZeroGDamping: root.attr('childRockZeroGDamping') ?? '',
        terrainFactorStaticThreshold: root.attr('terrainFactorStaticThreshold') ?? '',
        showExplosionFXForSurplusChild: root.attr('showExplosionFXForSurplusChild') ?? '',
        childRockInactivityLifetime: root.attr('childRockInactivityLifetime') ?? '',
        gadgetDetachThreshold: root.attr('gadgetDetachThreshold') ?? '',
        gadgetDestroyThreshold: root.attr('gadgetDestroyThreshold') ?? '',
        dangerToGadgetDamage: root.attr('dangerToGadgetDamage') ?? '',
        wasteResourceType: root.attr('wasteResourceType') ?? '',
        instabilityWavePeriod: $('mineableInstabilityParams').first().attr('instabilityWavePeriod') ?? '',
        instabilityWaveVariance: $('mineableInstabilityParams').first().attr('instabilityWaveVariance') ?? '',
        instabilityCurveFactor: $('mineableInstabilityParams').first().attr('instabilityCurveFactor') ?? '',
        dangerPoolFactor: $('mineableExplosionParams').first().attr('dangerPoolFactor') ?? '',
        explosionDefaultVolume: $('mineableExplosionParams').first().attr('defaultVolume') ?? '',
        hitHistoryWindow: $('hitConsistencyParams').first().attr('hitHistoryWindow') ?? '',
        standardDeviationMultiplier: $('hitConsistencyParams').first().attr('standardDeviationMultiplier') ?? '',
        timeExponent: $('hitConsistencyParams').first().attr('timeExponent') ?? '',
        minDeviation: $('hitConsistencyParams').first().attr('minDeviation') ?? '',
        extractionMagnitude: $('hitConsistencyParams').first().attr('extractionMagnitude') ?? '',
        maxEffectOnInstability: $('hitConsistencyParams').first().attr('maxEffectOnInstability') ?? '',
        fractureParticleEffect: $('fractureParticleEffect').first().attr('path') ?? '',
        explosionParticleEffect: $('explosionParticleEffect').first().attr('path') ?? '',
        centerRockDestroyParticleEffect: $('centerRockDestroyParticleEffect').first().attr('path') ?? '',
        fullyExtractedRockParticleEffect: $('fullyExtractedRockParticleEffect').first().attr('path') ?? '',
      });
    } else if (record.rootType === 'MiningAudioParams') {
      Object.assign(row, {
        mineablePowerIncreasingFallOff: root.attr('mineablePowerIncreasingFallOff') ?? '',
        mineablePowerLevelRtpc: $('mineablePowerLevelRtpc').first().attr('rtpc') ?? '',
        mineableDangerBreakingRtpc: $('mineableDangerBreakingRtpc').first().attr('rtpc') ?? '',
        mineableOptimalBreakingRtpc: $('mineableOptimalBreakingRtpc').first().attr('rtpc') ?? '',
        mineableMassRtpc: $('mineableMassRtpc').first().attr('rtpc') ?? '',
        mineableCrackGlowStrengthRtpc: $('mineableCrackGlowStrengthRtpc').first().attr('rtpc') ?? '',
        miningStartTrigger: $('miningStartTrigger').first().attr('audioTrigger') ?? '',
        miningStopTrigger: $('miningStopTrigger').first().attr('audioTrigger') ?? '',
        goodFracturedTrigger: $('goodFracturedTrigger').first().attr('audioTrigger') ?? '',
        badFracturedTrigger: $('badFracturedTrigger').first().attr('audioTrigger') ?? '',
        extractedTrigger: $('extractedTrigger').first().attr('audioTrigger') ?? '',
      });
    } else if (record.rootType === 'SEntityDensityClass') {
      Object.assign(row, {
        clusterDetectionRadius: root.attr('clusterDetectionRadius') ?? '',
        clusterUpperObjectCountDGS: root.attr('clusterUpperObjectCountDGS') ?? '',
        clusterUpperObjectCountPersistence: root.attr('clusterUpperObjectCountPersistence') ?? '',
        clusterPersistenceTimeout: root.attr('clusterPersistenceTimeout') ?? '',
        resetLifetimeOnMove: root.attr('resetLifetimeOnMove') ?? '',
        entityIdleBuryOnly: root.attr('entityIdleBuryOnly') ?? '',
      });
    }

    rows.push(row);
  }

  return rows;
}

async function collectMineableDensityRefs(options: ExtractDataCoreMiningParamsOptions): Promise<Set<string>> {
  const refs = new Set<string>();
  const records = options.graph
    .getByPathPrefix(options.mineableEntityPathPrefix ?? DEFAULT_MINEABLE_ENTITY_PATH_PREFIX)
    .filter((record) => record.rootType === 'EntityClassDefinition');

  for (const record of records) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore mineable entity XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const densityRef = $(':root').first().attr('entityDensityClass') ?? '';
    if (densityRef) refs.add(densityRef);
  }

  return refs;
}

function emptyRow(record: DataCoreRecordNode): DataCoreMiningParamRecord {
  return {
    ref: record.ref,
    path: record.path,
    paramType: record.rootType,
    paramClass: record.entityClass,
    highlightOccludedAlpha: '',
    highlightOutlineWidth: '',
    highlightDistantMineablesRange: '',
    showChildRockRadarIcon: '',
    scalePowerGraphMin: '',
    noProgressHintTime: '',
    noProgressHintPower: '',
    fractureDoneFeedbackDuration: '',
    maxScanRaycastDistance: '',
    highlightColor: '',
    highlightColorAbsorbable: '',
    highlightColorDistant: '',
    highlightColorDistantScanned: '',
    cameraShakeEnabled: '',
    cameraShakeTimePeriod: '',
    cameraShakeFrequencyNoiseFactor: '',
    cameraShakeTranslationNoise: '',
    cameraShakeRotationNoise: '',
    cameraShakeMaxUnderOptimalWindow: '',
    cameraShakeInOptimalWindow: '',
    cameraShakeMinInDangerWindow: '',
    cameraShakeChangeLerpSpeed: '',
    cameraShakeOffsetPosition: '',
    cameraShakeOffsetAngle: '',
    blockThrottleChangeWhenNotFiring: '',
    throttleResetOnStopFire: '',
    throttleChangePerAction: '',
    throttleAccPeriod: '',
    throttleAccFactor: '',
    throttleHoldAccFactor: '',
    throttleRtpc: '',
    powerCapacityPerMass: '',
    decayPerMass: '',
    optimalWindowSize: '',
    optimalWindowFactor: '',
    resistanceCurveFactor: '',
    optimalWindowThinnessCurveFactor: '',
    optimalWindowMaxSize: '',
    controlledBreakingFillRate: '',
    controlledBreakingFillRateDanger: '',
    controlledBreakingDecayRate: '',
    dangerBreakingFillRate: '',
    dangerBreakingFillRateExponent: '',
    dangerBreakingDecayRate: '',
    absorbableVolumeThreshold: '',
    childRockInvulnerabilityTime: '',
    cSCUPerVolume: '',
    defaultMass: '',
    modifierPersistenceTime: '',
    childRockLifeTimer: '',
    childRockZeroGDamping: '',
    terrainFactorStaticThreshold: '',
    showExplosionFXForSurplusChild: '',
    childRockInactivityLifetime: '',
    gadgetDetachThreshold: '',
    gadgetDestroyThreshold: '',
    dangerToGadgetDamage: '',
    wasteResourceType: '',
    instabilityWavePeriod: '',
    instabilityWaveVariance: '',
    instabilityCurveFactor: '',
    dangerPoolFactor: '',
    explosionDefaultVolume: '',
    hitHistoryWindow: '',
    standardDeviationMultiplier: '',
    timeExponent: '',
    minDeviation: '',
    extractionMagnitude: '',
    maxEffectOnInstability: '',
    fractureParticleEffect: '',
    explosionParticleEffect: '',
    centerRockDestroyParticleEffect: '',
    fullyExtractedRockParticleEffect: '',
    mineablePowerIncreasingFallOff: '',
    mineablePowerLevelRtpc: '',
    mineableDangerBreakingRtpc: '',
    mineableOptimalBreakingRtpc: '',
    mineableMassRtpc: '',
    mineableCrackGlowStrengthRtpc: '',
    miningStartTrigger: '',
    miningStopTrigger: '',
    goodFracturedTrigger: '',
    badFracturedTrigger: '',
    extractedTrigger: '',
    clusterDetectionRadius: '',
    clusterUpperObjectCountDGS: '',
    clusterUpperObjectCountPersistence: '',
    clusterPersistenceTimeout: '',
    resetLifetimeOnMove: '',
    entityIdleBuryOnly: '',
  };
}

function paramSortKey(record: DataCoreRecordNode): string {
  return `${record.rootType}:${record.path}`;
}

function rgba(element: { length: number; attr(name: string): string | undefined }): string {
  if (!element.length) return '';
  return [element.attr('r') ?? '', element.attr('g') ?? '', element.attr('b') ?? '', element.attr('a') ?? ''].join(',');
}

function xyz(element: { length: number; attr(name: string): string | undefined }): string {
  if (!element.length) return '';
  return [element.attr('x') ?? '', element.attr('y') ?? '', element.attr('z') ?? ''].join(',');
}
