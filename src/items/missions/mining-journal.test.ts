import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDataCoreMiningJournalRows, hasRenderableRarityRows } from './mining-journal';

test('buildDataCoreMiningJournalRows infers renderable rarity groups from DataCore mining facts', () => {
  const rows = buildDataCoreMiningJournalRows({
    elements: [
      elementRow('Copper_Ore', 'Copper (Ore)', 'copper-guid', { instability: '20', resistance: '-0.7' }),
      elementRow('Agricium_Ore', 'Agricium (Ore)', 'agricium-guid', { instability: '350', resistance: '0.5' }),
      elementRow('Quantainium_Raw', 'Quantainium (Raw)', 'quantainium-guid', {
        instability: '900',
        resistance: '0.9',
        explosionMultiplier: '12',
      }),
      elementRow('Hadanite', 'Hadanite', 'hadanite-guid', { instability: '100', resistance: '0.1' }),
    ],
    compositions: [
      compositionRow('copper-guid', 'Copper_Ore', '1'),
      compositionRow('agricium-guid', 'Agricium_Ore', '0.6'),
      compositionRow('quantainium-guid', 'Quantainium_Raw', '0.1'),
      compositionRow('hadanite-guid', 'Hadanite', '1'),
    ],
    qualityDistributions: [
      {
        'Distribution Type': 'default',
        'Mineable Family': 'shipmineables',
        'Min Quality': '501',
        'Max Quality': '1000',
      },
    ],
  });

  assert.equal(hasRenderableRarityRows(rows), true);
  assert.equal(rows[0]['Rarity Category'], 'Insights');
  assert.match(rows[0]['Insight Summary'], /Hardest: Quantainium \(Raw\)/);
  assert.match(rows[0]['Insight Summary'], /Quality Floors: shipmineables: 50\.1-100\.0%/);
  assert.equal(rows.find((row) => row['Rarity Category'] === 'Common')?.['Element List'], 'Copper (Ore)');
  assert.equal(rows.find((row) => row['Rarity Category'] === 'Uncommon')?.['Element List'], 'Agricium (Ore)');
  assert.equal(rows.find((row) => row['Rarity Category'] === 'Legendary')?.['Element List'], 'Quantainium (Raw)');
  assert.equal(rows.some((row) => row['Element List'].includes('Hadanite')), false);
});

function elementRow(
  elementClass: string,
  elementName: string,
  guid: string,
  facts: {
    instability: string;
    resistance: string;
    explosionMultiplier?: string;
  },
): Record<string, string> {
  return {
    'Element Class': elementClass,
    'Element Name': elementName,
    'Record GUID': guid,
    Instability: facts.instability,
    Resistance: facts.resistance,
    'Optimal Window Thinness': '1',
    'Optimal Window Randomness': '0.1',
    'Explosion Multiplier': facts.explosionMultiplier ?? '1',
  };
}

function compositionRow(guid: string, elementClass: string, probability: string): Record<string, string> {
  return {
    'Mineable Element GUID': guid,
    'Mineable Element Class': elementClass,
    Probability: probability,
  };
}
