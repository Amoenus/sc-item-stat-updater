import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreMissionBrokers } from './mission-broker-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

test('extractDataCoreMissionBrokers emits first-party mission broker fields', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-mission-broker-'));
  const brokerPath = 'libs/foundry/records/missionbroker/pu_missions/test_broker.xml';
  await fs.mkdir(path.dirname(path.join(xmlCacheDir, brokerPath)), { recursive: true });
  await fs.writeFile(
    path.join(xmlCacheDir, brokerPath),
    `
      <MissionBrokerEntry.TestBroker
        owner="stale-owner-guid"
        missionModule="libs/subsumption/missions/test.xml"
        title="@mission_title_stale"
        titleHUD="@mission_title_hud_stale"
        description="@mission_desc_stale"
        missionGiver="@mission_from_stale"
        commsChannelName="@mission_channel_stale"
        type="stale-type-guid"
        missionDifficulty="3"
        locationMissionAvailable="stale-location-guid"
        initiallyActive="1"
        notifyOnAvailable="0"
        showAsOffer="1"
        requestOnly="0"
        lawfulMission="1"
        maxInstances="5"
        maxPlayersPerInstance="2"
        maxInstancesPerPlayer="1"
        canBeShared="1"
        onceOnly="0"
        tutorial="0"
        availableInPrison="0"
        failIfSentToPrison="1"
        failIfBecameCriminal="0"
        failIfLeavePrison="1"
        respawnTime="4"
        respawnTimeVariation="2"
        instanceHasLifeTime="1"
        showLifeTimeInMobiGlas="1"
        instanceLifeTime="30"
        instanceLifeTimeVariation="5"
        canReacceptAfterAbandoning="1"
        abandonedCooldownTime="6"
        abandonedCooldownTimeVariation="1"
        canReacceptAfterFailing="1"
        hasPersonalCooldown="1"
        personalCooldownTime="15"
        personalCooldownTimeVariation="3"
        missionGiverRecord="stale-giver-guid"
        __type="MissionBrokerEntry"
        __ref="broker-guid"
        __path="${brokerPath}">
        <missionReward reward="12500" max="25000" plusBonuses="1" currencyType="UEC" />
        <missionDeadline missionCompletionTime="20" missionAutoEnd="1" missionResultAfterTimerEnd="Failed" remainingTimeToShowTimer="5" />
      </MissionBrokerEntry.TestBroker>
    `,
  );

  const graph: DataCoreRecordGraph = {
    source: 'datacore-record-graph',
    recordCount: 5,
    records: [
      {
        path: brokerPath,
        ref: 'broker-guid',
        rootTag: 'MissionBrokerEntry.TestBroker',
        rootType: 'MissionBrokerEntry',
        entityClass: 'TestBroker',
        localizationKeys: [
          { attribute: 'title', key: 'LOC_PLACEHOLDER' },
          { attribute: 'title', key: 'mission_title' },
          { attribute: 'titleHUD', key: 'LOC_UNINITIALIZED' },
          { attribute: 'titleHUD', key: 'mission_title_hud' },
          { attribute: 'description', key: 'LOC_PLACEHOLDER' },
          { attribute: 'displayDescription', key: 'mission_desc' },
          { attribute: 'missionGiver', key: 'mission_from' },
          { attribute: 'commsChannelName', key: 'mission_channel' },
        ],
        referencedGuids: ['giver-guid', 'location-guid', 'owner-guid', 'type-guid'],
        referencedGuidAttributes: [
          { attribute: 'locationMissionAvailable', value: '' },
          { attribute: 'locationMissionAvailable', value: 'location-guid' },
          { attribute: 'missionGiverRecord', value: '' },
          { attribute: 'missionGiverRecord', value: 'giver-guid' },
          { attribute: 'owner', value: '' },
          { attribute: 'owner', value: 'owner-guid' },
          { attribute: 'type', value: '' },
          { attribute: 'type', value: 'type-guid' },
        ],
      },
      record('owner-guid', 'FactionOwner'),
      record('type-guid', 'Bounty'),
      record('giver-guid', 'MissionGiverName'),
      record('location-guid', 'Area18'),
    ],
    indexes: {
      byRef: {
        'broker-guid': brokerPath,
        'owner-guid': 'factionowner.xml',
        'type-guid': 'bounty.xml',
        'giver-guid': 'missiongivername.xml',
        'location-guid': 'area18.xml',
      },
      byPath: {},
      byRootType: {},
      byEntityClass: {},
      byLocalizationKey: {},
      byReferencedGuid: {},
    },
  };

  assert.deepEqual(
    await extractDataCoreMissionBrokers({ xmlCacheDir, graph: createDataCoreRecordGraphLookup(graph) }),
    [
      {
        missionClass: 'TestBroker',
        titleKey: 'mission_title',
        titleHudKey: 'mission_title_hud',
        descriptionKey: 'mission_desc',
        missionGiverKey: 'mission_from',
        commsChannelNameKey: 'mission_channel',
        missionModule: 'libs/subsumption/missions/test.xml',
        missionTypeGuid: 'type-guid',
        missionTypeClass: 'Bounty',
        ownerGuid: 'owner-guid',
        ownerClass: 'FactionOwner',
        missionGiverRecordGuid: 'giver-guid',
        missionGiverRecordClass: 'MissionGiverName',
        locationMissionAvailableGuid: 'location-guid',
        locationMissionAvailableClass: 'Area18',
        missionDifficulty: '3',
        reward: '12500',
        rewardMax: '25000',
        rewardPlusBonuses: '1',
        currencyType: 'UEC',
        missionCompletionTime: '20',
        missionAutoEnd: '1',
        missionResultAfterTimerEnd: 'Failed',
        remainingTimeToShowTimer: '5',
        initiallyActive: '1',
        notifyOnAvailable: '0',
        showAsOffer: '1',
        requestOnly: '0',
        lawfulMission: '1',
        maxInstances: '5',
        maxPlayersPerInstance: '2',
        maxInstancesPerPlayer: '1',
        canBeShared: '1',
        onceOnly: '0',
        tutorial: '0',
        availableInPrison: '0',
        failIfSentToPrison: '1',
        failIfBecameCriminal: '0',
        failIfLeavePrison: '1',
        respawnTime: '4',
        respawnTimeVariation: '2',
        instanceHasLifeTime: '1',
        showLifeTimeInMobiGlas: '1',
        instanceLifeTime: '30',
        instanceLifeTimeVariation: '5',
        canReacceptAfterAbandoning: '1',
        abandonedCooldownTime: '6',
        abandonedCooldownTimeVariation: '1',
        canReacceptAfterFailing: '1',
        hasPersonalCooldown: '1',
        personalCooldownTime: '15',
        personalCooldownTimeVariation: '3',
        recordGuid: 'broker-guid',
        recordPath: brokerPath,
      },
    ],
  );
});

function record(ref: string, entityClass: string) {
  return {
    path: `${entityClass.toLowerCase()}.xml`,
    ref,
    rootTag: `Record.${entityClass}`,
    rootType: 'Record',
    entityClass,
    localizationKeys: [],
    referencedGuids: [],
  };
}
