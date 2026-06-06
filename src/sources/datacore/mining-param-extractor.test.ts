import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreMiningParams } from './mining-param-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

const entityPath = 'libs/foundry/records/entities/mineable/agriciumrock.xml';
const controllerPath = 'libs/foundry/records/mining/miningcontrollerparamsship.xml';
const laserPath = 'libs/foundry/records/mining/mininglaserglobalparams.xml';
const globalPath = 'libs/foundry/records/mining/miningglobalparamsship.xml';
const audioPath = 'libs/foundry/records/miningaudioparams/miningglobalaudioparams.xml';
const densityPath = 'libs/foundry/records/densityclasses/harvestablelootdensityclass.xml';
const unreferencedDensityPath = 'libs/foundry/records/densityclasses/defaultdensityclass.xml';

test('extractDataCoreMiningParams extracts mining param rows and only mineable-referenced density classes', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-mining-params-'));
  await writeXml(
    xmlCacheDir,
    laserPath,
    `<MiningLaserGlobalParams.MiningLaserGlobalParams blockThrottleChangeWhenNotFiring="0" throttleResetOnStopFire="1" throttleChangePerAction="0.01" throttleAccPeriod="0.1" throttleAccFactor="2" throttleHoldAccFactor="0.25" __type="MiningLaserGlobalParams" __ref="laser-guid" __path="${laserPath}">
      <throttleRTPC rtpc="Mineable_Laser_Throttle" />
    </MiningLaserGlobalParams.MiningLaserGlobalParams>`,
  );
  await writeXml(
    xmlCacheDir,
    controllerPath,
    `<MiningControllerGlobalParams.MiningControllerParamsShip highlightOccludedAlpha="0" highlightOutlineWidth="1" highlightDistantMineablesRange="150" showChildRockRadarIcon="1" scalePowerGraphMin="1" noProgressHintTime="60" noProgressHintPower="5" fractureDoneFeedbackDuration="3" maxScanRaycastDistance="1500" __type="MiningControllerGlobalParams" __ref="controller-guid" __path="${controllerPath}">
      <highlightColor r="1" g="0.5" b="0.25" a="0.75" />
      <highlightColorAbsorbable r="0.1" g="0.2" b="0.3" a="0.4" />
      <highlightColorDistant r="0.5" g="0.6" b="0.7" a="0.8" />
      <highlightColorDistantScanned r="0.9" g="0.8" b="0.7" a="0.6" />
      <cameraShakeConfig enabled="1" timePeriod="0.2" frequencyNoiseFactor="0" translationNoise="0" rotationNoise="0" maxShakeWhenUnderOptimalWindow="0.1" shakeInOptimalWindow="0.05" minShakeInDangerWindow="0.3" shakeChangeLerpSpeed="0.6">
        <offsetPosition x="0.025" y="0.025" z="0.025" />
        <offsetAngle x="2" y="2" z="2" />
      </cameraShakeConfig>
    </MiningControllerGlobalParams.MiningControllerParamsShip>`,
  );
  await writeXml(
    xmlCacheDir,
    entityPath,
    `<EntityClassDefinition.AgriciumRock entityDensityClass="density-guid" __type="EntityClassDefinition" __ref="entity-guid" __path="${entityPath}">
      <MineableParams globalParams="global-guid" audioParams="audio-guid" />
    </EntityClassDefinition.AgriciumRock>`,
  );
  await writeXml(
    xmlCacheDir,
    globalPath,
    `<MiningGlobalParams.MiningGlobalParamsShip powerCapacityPerMass="10" decayPerMass="0.2" optimalWindowSize="0.1" wasteResourceType="waste-guid" __type="MiningGlobalParams" __ref="global-guid" __path="${globalPath}">
      <mineableInstabilityParams instabilityWavePeriod="3" instabilityWaveVariance="1" instabilityCurveFactor="2" />
      <mineableExplosionParams dangerPoolFactor="560" defaultVolume="5122.499" />
      <fractureParticleEffect path="fracture" />
      <explosionParticleEffect path="explosion" />
      <centerRockDestroyParticleEffect path="center" />
      <fullyExtractedRockParticleEffect path="extracted" />
      <hitConsistencyParams hitHistoryWindow="4" standardDeviationMultiplier="10" timeExponent="2" minDeviation="0.1" extractionMagnitude="1" maxEffectOnInstability="0.5" />
    </MiningGlobalParams.MiningGlobalParamsShip>`,
  );
  await writeXml(
    xmlCacheDir,
    audioPath,
    `<MiningAudioParams.MiningGlobalAudioParams mineablePowerIncreasingFallOff="1" __type="MiningAudioParams" __ref="audio-guid" __path="${audioPath}">
      <mineablePowerLevelRtpc rtpc="Mineable_Rock_Power_Level" />
      <miningStartTrigger audioTrigger="Play_Mining" />
      <goodFracturedTrigger audioTrigger="Play_Good" />
      <badFracturedTrigger audioTrigger="Play_Bad" />
      <extractedTrigger audioTrigger="Play_Despawn" />
    </MiningAudioParams.MiningGlobalAudioParams>`,
  );
  await writeXml(
    xmlCacheDir,
    densityPath,
    `<SEntityDensityClass.HarvestableLootDensityClass clusterDetectionRadius="10" clusterUpperObjectCountDGS="100" clusterUpperObjectCountPersistence="50" clusterPersistenceTimeout="60" resetLifetimeOnMove="0" entityIdleBuryOnly="0" __type="SEntityDensityClass" __ref="density-guid" __path="${densityPath}" />`,
  );
  await writeXml(
    xmlCacheDir,
    unreferencedDensityPath,
    `<SEntityDensityClass.DefaultDensityClass clusterDetectionRadius="999" __type="SEntityDensityClass" __ref="unreferenced-density-guid" __path="${unreferencedDensityPath}" />`,
  );

  const rows = await extractDataCoreMiningParams({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph()),
  });

  assert.deepEqual(
    rows.map((row) => row.paramClass),
    [
      'MiningGlobalAudioParams',
      'MiningControllerParamsShip',
      'MiningGlobalParamsShip',
      'MiningLaserGlobalParams',
      'HarvestableLootDensityClass',
    ],
  );
  assert.equal(
    rows.find((row) => row.paramClass === 'MiningControllerParamsShip')?.highlightDistantMineablesRange,
    '150',
  );
  assert.equal(rows.find((row) => row.paramClass === 'MiningControllerParamsShip')?.highlightColor, '1,0.5,0.25,0.75');
  assert.equal(rows.find((row) => row.paramClass === 'MiningControllerParamsShip')?.cameraShakeOffsetAngle, '2,2,2');
  assert.equal(rows.find((row) => row.paramClass === 'MiningLaserGlobalParams')?.throttleResetOnStopFire, '1');
  assert.equal(
    rows.find((row) => row.paramClass === 'MiningLaserGlobalParams')?.throttleRtpc,
    'Mineable_Laser_Throttle',
  );
  assert.equal(rows.find((row) => row.paramClass === 'MiningGlobalParamsShip')?.powerCapacityPerMass, '10');
  assert.equal(rows.find((row) => row.paramClass === 'MiningGlobalParamsShip')?.instabilityWavePeriod, '3');
  assert.equal(rows.find((row) => row.paramClass === 'MiningGlobalParamsShip')?.fractureParticleEffect, 'fracture');
  assert.equal(
    rows.find((row) => row.paramClass === 'MiningGlobalAudioParams')?.mineablePowerLevelRtpc,
    'Mineable_Rock_Power_Level',
  );
  assert.equal(rows.find((row) => row.paramClass === 'MiningGlobalAudioParams')?.miningStartTrigger, 'Play_Mining');
  assert.equal(rows.find((row) => row.paramClass === 'HarvestableLootDensityClass')?.clusterDetectionRadius, '10');
  assert.equal(
    rows.some((row) => row.paramClass === 'DefaultDensityClass'),
    false,
  );
});

async function writeXml(xmlCacheDir: string, recordPath: string, xml: string): Promise<void> {
  const xmlPath = path.join(xmlCacheDir, recordPath);
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(xmlPath, xml, 'utf8');
}

function makeGraph(): DataCoreRecordGraph {
  const records = [
    node(entityPath, 'entity-guid', 'EntityClassDefinition.AgriciumRock', 'EntityClassDefinition', 'AgriciumRock'),
    node(
      controllerPath,
      'controller-guid',
      'MiningControllerGlobalParams.MiningControllerParamsShip',
      'MiningControllerGlobalParams',
      'MiningControllerParamsShip',
    ),
    node(
      laserPath,
      'laser-guid',
      'MiningLaserGlobalParams.MiningLaserGlobalParams',
      'MiningLaserGlobalParams',
      'MiningLaserGlobalParams',
    ),
    node(
      globalPath,
      'global-guid',
      'MiningGlobalParams.MiningGlobalParamsShip',
      'MiningGlobalParams',
      'MiningGlobalParamsShip',
    ),
    node(
      audioPath,
      'audio-guid',
      'MiningAudioParams.MiningGlobalAudioParams',
      'MiningAudioParams',
      'MiningGlobalAudioParams',
    ),
    node(
      densityPath,
      'density-guid',
      'SEntityDensityClass.HarvestableLootDensityClass',
      'SEntityDensityClass',
      'HarvestableLootDensityClass',
    ),
    node(
      unreferencedDensityPath,
      'unreferenced-density-guid',
      'SEntityDensityClass.DefaultDensityClass',
      'SEntityDensityClass',
      'DefaultDensityClass',
    ),
  ];

  return {
    source: 'datacore-record-graph',
    recordCount: records.length,
    records,
    indexes: {
      byRef: Object.fromEntries(records.map((record) => [record.ref, record.path])),
      byPath: Object.fromEntries(records.map((record, index) => [record.path, index])),
      byRootType: {},
      byEntityClass: {},
      byLocalizationKey: {},
      byReferencedGuid: {},
    },
  };
}

function node(path: string, ref: string, rootTag: string, rootType: string, entityClass: string) {
  return {
    path,
    ref,
    rootTag,
    rootType,
    entityClass,
    localizationKeys: [],
    referencedGuids: [],
  };
}
