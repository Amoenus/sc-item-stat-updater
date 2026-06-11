import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDataCoreMissionContractIntel } from './mission-contract-intel-builder';
import type { DataCoreMissionBrokerRecord } from './types';

test('buildDataCoreMissionContractIntel derives rendered intel from broker facts', () => {
  assert.deepEqual(
    buildDataCoreMissionContractIntel([
      broker({
        missionClass: 'BountyIntro',
        descriptionKey: 'bounty_intro_desc',
        reward: '12500',
        missionCompletionTime: '25',
        hasPersonalCooldown: '1',
        personalCooldownTime: '75',
      }),
    ]),
    [
      {
        missionClass: 'BountyIntro',
        descriptionKey: 'bounty_intro_desc',
        contractIntel: String.raw`Reward: 12,500 aUEC\nTime Limit: 25 min\nCooldown: 1 h 15 min`,
        cooldown: '1 h 15 min',
        reward: '12500',
        rewardCurrency: 'UEC',
        timeLimit: '25',
        efficiency: '',
        missionDifficulty: 'Easy',
        recordGuid: 'broker-guid',
        recordPath: 'libs/foundry/records/missionbroker/bountyintro.xml',
      },
    ],
  );
});

test('buildDataCoreMissionContractIntel skips rows without description keys or intel fields', () => {
  assert.deepEqual(
    buildDataCoreMissionContractIntel([
      broker({ descriptionKey: '', reward: '1000' }),
      broker({ descriptionKey: 'empty_desc', reward: '0', missionCompletionTime: '0', hasPersonalCooldown: '0' }),
    ]),
    [],
  );
});

function broker(overrides: Partial<DataCoreMissionBrokerRecord> = {}): DataCoreMissionBrokerRecord {
  return {
    missionClass: 'BountyIntro',
    titleKey: 'bounty_intro_title',
    titleHudKey: '',
    descriptionKey: 'bounty_intro_desc',
    missionGiverKey: '',
    commsChannelNameKey: '',
    missionModule: '',
    missionTypeGuid: '',
    missionTypeClass: '',
    ownerGuid: '',
    ownerClass: '',
    missionGiverRecordGuid: '',
    missionGiverRecordClass: '',
    locationMissionAvailableGuid: '',
    locationMissionAvailableClass: '',
    missionDifficulty: 'Easy',
    reward: '0',
    rewardMax: '',
    rewardPlusBonuses: '',
    currencyType: 'UEC',
    missionCompletionTime: '0',
    missionAutoEnd: '',
    missionResultAfterTimerEnd: '',
    remainingTimeToShowTimer: '',
    initiallyActive: '',
    notifyOnAvailable: '',
    showAsOffer: '',
    requestOnly: '',
    lawfulMission: '',
    maxInstances: '',
    maxPlayersPerInstance: '',
    maxInstancesPerPlayer: '',
    canBeShared: '',
    onceOnly: '',
    tutorial: '',
    availableInPrison: '',
    failIfSentToPrison: '',
    failIfBecameCriminal: '',
    failIfLeavePrison: '',
    respawnTime: '',
    respawnTimeVariation: '',
    instanceHasLifeTime: '',
    showLifeTimeInMobiGlas: '',
    instanceLifeTime: '',
    instanceLifeTimeVariation: '',
    canReacceptAfterAbandoning: '',
    abandonedCooldownTime: '',
    abandonedCooldownTimeVariation: '',
    canReacceptAfterFailing: '',
    hasPersonalCooldown: '0',
    personalCooldownTime: '0',
    personalCooldownTimeVariation: '',
    recordGuid: 'broker-guid',
    recordPath: 'libs/foundry/records/missionbroker/bountyintro.xml',
    ...overrides,
  };
}
