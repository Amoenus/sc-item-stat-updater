import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScmdbMergedDTO } from '../../schema/scmdb.schemas';
import { buildScmdbOutputRows, SCMDB_CONTRACT_HEADERS, SCMDB_MINING_ELEMENT_HEADERS } from './outputs';

test('buildScmdbOutputRows builds empty row groups for empty SCMDB data', () => {
  const rows = buildScmdbOutputRows(emptyMergedData(), null);

  assert.deepEqual(rows.missionRows, []);
  assert.deepEqual(rows.contractRows, []);
  assert.deepEqual(rows.legacyRows, []);
  assert.deepEqual(rows.blueprintPoolRows, []);
  assert.deepEqual(rows.contractBlueprintRows, []);
  assert.deepEqual(rows.miningElementRows, []);
  assert.deepEqual(rows.miningJournalRows, []);
});

test('buildScmdbOutputRows includes mining output groups when mining data is present', () => {
  const rows = buildScmdbOutputRows(emptyMergedData(), {
    mineableElements: {
      agricium: {
        name: 'Agricium (Ore)',
        rarity: 'uncommon',
        scanSignature: 3885,
        resistance: 0.5,
        instability: 350,
      },
    },
    refineryProfiles: {},
    refineries: {},
  } as never);

  assert.equal(rows.miningElementRows.length, 1);
  assert.equal(rows.miningJournalRows.length > 0, true);
});

test('SCMDB output headers expose the scraper CSV contracts', () => {
  assert.equal(SCMDB_CONTRACT_HEADERS[0], 'id');
  assert.equal(SCMDB_CONTRACT_HEADERS.at(-1), 'propertyValues');
  assert.equal(SCMDB_MINING_ELEMENT_HEADERS.includes('Mining Difficulty'), true);
});

test('buildScmdbOutputRows populates stable blueprint marker fields', () => {
  const rows = buildScmdbOutputRows(
    {
      ...emptyMergedData(),
      contracts: [
        contract({
          id: 'prereq-root',
          debugName: 'Prerequisite Root',
          completionTags: [{ tag: 'root-complete', count: 1, splitPointsForParty: false }],
        }),
        contract({
          id: 'prereq-child',
          debugName: 'Prerequisite Child',
          prerequisites: { completedContractTags: { tags: ['root-complete'] } },
          completionTags: [{ tag: 'child-complete', count: 1, splitPointsForParty: false }],
        }),
        contract({
          id: 'blueprint-reward',
          debugName: 'Blueprint Reward',
          prerequisites: { completedContractTags: { tags: ['child-complete'] } },
          blueprintRewards: [
            { blueprintPool: 'pool-alpha', chance: 1, poolName: 'Alpha Pool', trigger: 'MissionSuccess' },
          ],
        }),
        contract({
          id: 'unrelated',
          debugName: 'Unrelated Contract',
        }),
      ],
    } as never,
    null,
  );
  const byId = new Map(rows.contractRows.map((row) => [row.id, row]));

  assert.deepEqual(markerFields(byId.get('blueprint-reward')), {
    isBlueprintReward: 'true',
    isBlueprintChainPrerequisite: 'false',
    blueprintChainDepth: '0',
  });
  assert.deepEqual(markerFields(byId.get('prereq-child')), {
    isBlueprintReward: 'false',
    isBlueprintChainPrerequisite: 'true',
    blueprintChainDepth: '1',
  });
  assert.deepEqual(markerFields(byId.get('prereq-root')), {
    isBlueprintReward: 'false',
    isBlueprintChainPrerequisite: 'true',
    blueprintChainDepth: '2',
  });
  assert.deepEqual(markerFields(byId.get('unrelated')), {
    isBlueprintReward: 'false',
    isBlueprintChainPrerequisite: 'false',
    blueprintChainDepth: '',
  });
});

function contract(overrides: Record<string, unknown> = {}) {
  const id = String(overrides.id ?? 'contract');
  return {
    id,
    debugName: id,
    category: 'General',
    missionType: null,
    missionTypeKey: null,
    title: `${id} title`,
    description: `${id} description`,
    factionGuid: null,
    canBeShared: true,
    illegal: false,
    timeToComplete: 0,
    locations: null,
    destinations: null,
    locationSets: null,
    prerequisites: {},
    pyroRegion: null,
    rewardUEC: null,
    buyIn: null,
    minStanding: null,
    maxStanding: null,
    shipEncounters: null,
    propertyValues: null,
    titleKey: `${id}_title`,
    descriptionKey: `${id}_desc`,
    haulingOrders: null,
    descriptionLocKey: `${id}_desc`,
    titleLocKey: `${id}_title`,
    onceOnly: false,
    maxPlayersPerInstance: 1,
    availableInPrison: false,
    canReacceptAfterAbandoning: true,
    canReacceptAfterFailing: true,
    hasPersonalCooldown: false,
    personalCooldownTime: 0,
    abandonedCooldownTime: 0,
    hideInMobiGlas: false,
    partialRewardPayoutIndex: 0,
    availabilityIndex: 0,
    ...overrides,
  };
}

function markerFields(
  row: { isBlueprintReward: string; isBlueprintChainPrerequisite: string; blueprintChainDepth: string } | undefined,
) {
  assert.ok(row, 'expected contract row to exist');
  return {
    isBlueprintReward: row.isBlueprintReward,
    isBlueprintChainPrerequisite: row.isBlueprintChainPrerequisite,
    blueprintChainDepth: row.blueprintChainDepth,
  };
}

function emptyMergedData(): ScmdbMergedDTO {
  return {
    contracts: [],
    legacyContracts: [],
    blueprintPools: {},
    factionRewardsPools: [],
    factions: {},
  } as never;
}
