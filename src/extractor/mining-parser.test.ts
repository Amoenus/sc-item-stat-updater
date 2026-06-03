import assert from 'node:assert';
import { describe, it } from 'node:test';
import { buildMiningElementRows, buildMiningJournalRows, deriveMiningDifficulty } from './mining-parser';

describe('SCMDB mining parser enrichment', () => {
  it('derives representative difficulty labels', () => {
    assert.strictEqual(deriveMiningDifficulty({ resistance: 0.1, instability: 50 }), 'Easy');
    assert.strictEqual(
      deriveMiningDifficulty({
        resistance: 0.8,
        instability: 700,
        optimalWindowThinness: 4,
        optimalWindowRandomness: 0.4,
        explosionMultiplier: 8,
      }),
      'Extreme',
    );
  });

  it('adds behavior labels and best refinery hints to element rows', () => {
    const rows = buildMiningElementRows({
      mineableElements: {
        agricium: {
          name: 'Agricium (Ore)',
          rarity: 'uncommon',
          scanSignature: 3885,
          groundScanSignature: 4000,
          resistance: 0.5,
          instability: 350,
          optimalWindowMidpoint: 0.5,
          optimalWindowRandomness: 0.15,
          optimalWindowThinness: 2,
          explosionMultiplier: 4,
          clusterFactor: 0.2,
          qualityBands: [346, 588],
          density: 7.14,
        },
      },
      refineryProfiles: {
        profile1: { 'Agricium (Ore)': 5 },
        profile2: { 'Agricium (Ore)': 3 },
      },
      refineries: {
        refinery1: { name: 'ARC-L1 Wide Forest Station', profileId: 'profile1' },
      },
    });

    assert.strictEqual(rows[0]['Mining Difficulty'], 'Difficult');
    assert.strictEqual(rows[0]['Volatility Note'], 'Unstable charge behavior');
    assert.strictEqual(rows[0]['Cluster Note'], 'Isolated');
    assert.strictEqual(rows[0]['Quality Bands'], '34.6% / 58.8%');
    assert.strictEqual(rows[0]['Best Refinery'], 'ARC-L1 Wide Forest Station (+5)');
  });

  it('adds a compact mining journal insight row', () => {
    const rows = buildMiningJournalRows({
      mineableElements: {
        easy: { name: 'Easyite (Ore)', rarity: 'common', resistance: 0.1, instability: 50 },
        hard: { name: 'Hardite (Ore)', rarity: 'rare', resistance: 0.8, instability: 700, explosionMultiplier: 8 },
      },
      refineryProfiles: {},
      refineries: {},
    });

    assert.strictEqual(rows[0]['Rarity Category'], 'Insights');
    assert.match(rows[0]['Insight Summary'] ?? '', /Hardest:/);
    assert.match(rows[0]['Insight Summary'] ?? '', /Most Volatile:/);
  });
});
