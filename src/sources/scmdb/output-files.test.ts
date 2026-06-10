import assert from 'node:assert/strict';
import test from 'node:test';
import { planScmdbOutputFiles } from './output-files';
import { SCMDB_CONTRACT_HEADERS, type ScmdbOutputRows } from './outputs';

const EXPECTED_LEGACY_CONTRACT_HEADERS = [
  'id',
  'debugName',
  'category',
  'missionType',
  'missionTypeKey',
  'title',
  'titleKey',
  'description',
  'descriptionKey',
  'descriptionLocKey',
  'rewardUEC',
  'timeToComplete',
  'canBeShared',
  'illegal',
  'factionGuid',
  'locations',
  'destinations',
  'prerequisites',
  'tokenSubstitutions',
  'minStanding',
  'maxStanding',
  'blueprintRewards',
  'isBlueprintReward',
  'isBlueprintChainPrerequisite',
  'blueprintChainDepth',
  'personalCooldownTime',
  'rewardRepCalculated',
  'factionRewards',
  'factionRewardsRaw',
  'shipEncounters',
  'haulingOrders',
  'itemRewards',
  'completionTags',
  'pyroRegion',
  'buyIn',
  'onceOnly',
  'maxPlayersPerInstance',
  'availableInPrison',
  'canReacceptAfterAbandoning',
  'canReacceptAfterFailing',
  'hasPersonalCooldown',
  'abandonedCooldownTime',
  'hideInMobiGlas',
  'systems',
  'factionRewards_fail',
  'requiredScenarios',
  'isIntro',
  'requiredIntros',
  'linkedIntros',
  'pickupCount',
  'deliveryCount',
  'propertyValues',
];

test('planScmdbOutputFiles omits empty row groups', () => {
  assert.deepEqual(planScmdbOutputFiles(emptyRows()), []);
});

test('planScmdbOutputFiles returns output descriptors in scraper write order', () => {
  const files = planScmdbOutputFiles({
    ...emptyRows(),
    missionRows: [{ 'Localization Key': 'mission_desc' }] as never,
    contractRows: [{ id: 'contract-1' }] as never,
    miningJournalRows: [{ 'Rarity Category': 'Insights' }] as never,
  });

  assert.deepEqual(
    files.map((file) => ({ fileName: file.fileName, section: file.section })),
    [
      { fileName: 'scmdb-missions.csv', section: 'missions' },
      { fileName: 'contracts.csv', section: 'root' },
      { fileName: 'mining-journal.csv', section: 'root' },
    ],
  );
  assert.equal(files[0].headers[0], 'Localization Key');
  assert.equal(files[1].headers[0], 'id');
  assert.equal(files[2].headers[0], 'Rarity Category');
});

test('legacy-contracts.csv uses the stable downstream contract header order', () => {
  const files = planScmdbOutputFiles({
    ...emptyRows(),
    legacyRows: [{ id: 'legacy-contract-1' }] as never,
  });
  const legacyFile = files.find((file) => file.fileName === 'legacy-contracts.csv');

  assert.ok(legacyFile, 'legacy-contracts.csv descriptor should be emitted when legacy rows exist');
  assert.deepEqual(SCMDB_CONTRACT_HEADERS, EXPECTED_LEGACY_CONTRACT_HEADERS);
  assert.deepEqual(legacyFile.headers, EXPECTED_LEGACY_CONTRACT_HEADERS);
  assert.deepEqual(legacyFile.headers.slice(22, 25), [
    'isBlueprintReward',
    'isBlueprintChainPrerequisite',
    'blueprintChainDepth',
  ]);
});

function emptyRows(): ScmdbOutputRows {
  return {
    missionRows: [],
    contractRows: [],
    legacyRows: [],
    miningElementRows: [],
    miningJournalRows: [],
  };
}
