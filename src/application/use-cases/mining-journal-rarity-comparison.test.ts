import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareMiningJournalRarityRows,
  formatMiningJournalRarityComparison,
} from './mining-journal-rarity-comparison';

test('mining journal rarity comparison counts matches, mismatches, and missing elements', () => {
  const comparison = compareMiningJournalRarityRows({
    scmdbRows: [
      journalRow('Common', ['Copper (Ore)', 'Iron (Ore)']),
      journalRow('Rare', ['Gold (Ore)']),
      journalRow('Insights', []),
    ],
    datacoreRows: [
      journalRow('Common', ['Copper (Ore)', 'Tin (Ore)']),
      journalRow('Uncommon', ['Iron (Ore)']),
      journalRow('Legendary', ['Quantainium (Raw)']),
    ],
  });

  assert.equal(comparison.scmdbRows, 3);
  assert.equal(comparison.datacoreRows, 3);
  assert.equal(comparison.scmdbElements, 3);
  assert.equal(comparison.datacoreElements, 4);
  assert.equal(comparison.matchedElements, 1);
  assert.deepEqual(comparison.mismatches, [
    {
      element: 'Iron (Ore)',
      scmdbRarity: 'Common',
      datacoreRarity: 'Uncommon',
    },
  ]);
  assert.deepEqual(comparison.missingFromDataCore, [{ element: 'Gold (Ore)', scmdbRarity: 'Rare' }]);
  assert.deepEqual(comparison.missingFromScmdb, [
    { element: 'Quantainium (Raw)', datacoreRarity: 'Legendary' },
    { element: 'Tin (Ore)', datacoreRarity: 'Common' },
  ]);
  assert.equal(comparison.scmdbGroupCounts.Common, 2);
  assert.equal(comparison.datacoreGroupCounts.Common, 2);
  assert.equal(comparison.usableDataCore, true);

  const formatted = formatMiningJournalRarityComparison(comparison);
  assert.match(formatted, /Matching rarity labels: 1\/3/);
  assert.match(formatted, /Iron \(Ore\): SCMDB=Common, DataCore=Uncommon/);
  assert.match(formatted, /Gold \(Ore\): SCMDB=Rare, DataCore=-/);
  assert.match(formatted, /Quantainium \(Raw\): SCMDB=-, DataCore=Legendary/);
});

test('mining journal rarity comparison ignores non-rarity rows', () => {
  const comparison = compareMiningJournalRarityRows({
    scmdbRows: [journalRow('Insights', ['Not a mineral']), journalRow('Unknown', ['Unknownite (Ore)'])],
    datacoreRows: [],
  });

  assert.equal(comparison.scmdbElements, 0);
  assert.equal(comparison.datacoreElements, 0);
  assert.equal(comparison.usableDataCore, false);
});

function journalRow(rarity: string, elements: string[]): Record<string, string> {
  return {
    'Rarity Category': rarity,
    'Element List': elements.join('\n'),
    'Insight Summary': '',
  };
}
