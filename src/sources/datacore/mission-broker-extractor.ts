import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import type { DataCoreMissionBrokerRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_MISSION_BROKER_PATH_PREFIX = 'libs/foundry/records/missionbroker';

export interface ExtractDataCoreMissionBrokerOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  missionBrokerPathPrefix?: string;
  onProgress?: (current: number, total: number) => void;
}

export async function extractDataCoreMissionBrokers(
  options: ExtractDataCoreMissionBrokerOptions,
): Promise<DataCoreMissionBrokerRecord[]> {
  const records = options.graph
    .getByPathPrefix(options.missionBrokerPathPrefix ?? DEFAULT_MISSION_BROKER_PATH_PREFIX)
    .filter((record) => record.rootType === 'MissionBrokerEntry')
    .sort((a, b) => a.path.localeCompare(b.path));
  const rows: DataCoreMissionBrokerRecord[] = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    options.onProgress?.(i, records.length);
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore MissionBroker XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const root = $(':root').first();
    if (!root.length) continue;

    const missionTypeGuid = root.attr('type') ?? '';
    const ownerGuid = root.attr('owner') ?? '';
    const missionGiverRecordGuid = root.attr('missionGiverRecord') ?? '';
    const locationMissionAvailableGuid = root.attr('locationMissionAvailable') ?? '';
    const missionReward = root.find('> missionReward').first();
    const missionDeadline = root.find('> missionDeadline').first();

    rows.push({
      missionClass: record.entityClass,
      titleKey: localizationKey(root.attr('title') ?? ''),
      titleHudKey: localizationKey(root.attr('titleHUD') ?? ''),
      descriptionKey: localizationKey(root.attr('description') ?? ''),
      missionGiverKey: localizationKey(root.attr('missionGiver') ?? ''),
      commsChannelNameKey: localizationKey(root.attr('commsChannelName') ?? ''),
      missionModule: root.attr('missionModule') ?? '',
      missionTypeGuid,
      missionTypeClass: linkedClass(options.graph.getByRef(missionTypeGuid)),
      ownerGuid,
      ownerClass: linkedClass(options.graph.getByRef(ownerGuid)),
      missionGiverRecordGuid,
      missionGiverRecordClass: linkedClass(options.graph.getByRef(missionGiverRecordGuid)),
      locationMissionAvailableGuid,
      locationMissionAvailableClass: linkedClass(options.graph.getByRef(locationMissionAvailableGuid)),
      missionDifficulty: root.attr('missionDifficulty') ?? '',
      reward: missionReward.attr('reward') ?? '',
      rewardMax: missionReward.attr('max') ?? '',
      rewardPlusBonuses: missionReward.attr('plusBonuses') ?? '',
      currencyType: missionReward.attr('currencyType') ?? '',
      missionCompletionTime: missionDeadline.attr('missionCompletionTime') ?? '',
      missionAutoEnd: missionDeadline.attr('missionAutoEnd') ?? '',
      missionResultAfterTimerEnd: missionDeadline.attr('missionResultAfterTimerEnd') ?? '',
      remainingTimeToShowTimer: missionDeadline.attr('remainingTimeToShowTimer') ?? '',
      initiallyActive: root.attr('initiallyActive') ?? '',
      notifyOnAvailable: root.attr('notifyOnAvailable') ?? '',
      showAsOffer: root.attr('showAsOffer') ?? '',
      requestOnly: root.attr('requestOnly') ?? '',
      lawfulMission: root.attr('lawfulMission') ?? '',
      maxInstances: root.attr('maxInstances') ?? '',
      maxPlayersPerInstance: root.attr('maxPlayersPerInstance') ?? '',
      maxInstancesPerPlayer: root.attr('maxInstancesPerPlayer') ?? '',
      canBeShared: root.attr('canBeShared') ?? '',
      onceOnly: root.attr('onceOnly') ?? '',
      tutorial: root.attr('tutorial') ?? '',
      availableInPrison: root.attr('availableInPrison') ?? '',
      failIfSentToPrison: root.attr('failIfSentToPrison') ?? '',
      failIfBecameCriminal: root.attr('failIfBecameCriminal') ?? '',
      failIfLeavePrison: root.attr('failIfLeavePrison') ?? '',
      respawnTime: root.attr('respawnTime') ?? '',
      respawnTimeVariation: root.attr('respawnTimeVariation') ?? '',
      instanceHasLifeTime: root.attr('instanceHasLifeTime') ?? '',
      showLifeTimeInMobiGlas: root.attr('showLifeTimeInMobiGlas') ?? '',
      instanceLifeTime: root.attr('instanceLifeTime') ?? '',
      instanceLifeTimeVariation: root.attr('instanceLifeTimeVariation') ?? '',
      canReacceptAfterAbandoning: root.attr('canReacceptAfterAbandoning') ?? '',
      abandonedCooldownTime: root.attr('abandonedCooldownTime') ?? '',
      abandonedCooldownTimeVariation: root.attr('abandonedCooldownTimeVariation') ?? '',
      canReacceptAfterFailing: root.attr('canReacceptAfterFailing') ?? '',
      hasPersonalCooldown: root.attr('hasPersonalCooldown') ?? '',
      personalCooldownTime: root.attr('personalCooldownTime') ?? '',
      personalCooldownTimeVariation: root.attr('personalCooldownTimeVariation') ?? '',
      recordGuid: record.ref,
      recordPath: record.path,
    });
  }

  options.onProgress?.(records.length, records.length);
  return rows;
}

function linkedClass(record: DataCoreRecordNode | undefined): string {
  return record?.entityClass ?? '';
}

function localizationKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '@LOC_EMPTY' || trimmed === '@LOC_UNINITIALIZED') return '';
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}
