import assert from 'node:assert/strict';
import test from 'node:test';
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
  assert.deepEqual(rows.miningLocationRows, []);
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
  assert.equal(rows.miningLocationRows.length, 0);
});

test('SCMDB output headers expose the scraper CSV contracts', () => {
  assert.equal(SCMDB_CONTRACT_HEADERS[0], 'id');
  assert.equal(SCMDB_CONTRACT_HEADERS.at(-1), 'propertyValues');
  assert.equal(SCMDB_MINING_ELEMENT_HEADERS.includes('Mining Difficulty'), true);
});

function emptyMergedData() {
  return {
    contracts: [],
    legacyContracts: [],
    blueprintPools: {},
    factionRewardsPools: [],
    factions: {},
  } as never;
}
