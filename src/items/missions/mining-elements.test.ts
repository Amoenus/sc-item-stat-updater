import assert from 'node:assert';
import { describe, it } from 'node:test';
import config from './mining-elements';

const { buildValue, getTargetKeys } = config;
assert.ok(buildValue, 'buildValue must be defined on the mining elements config');
assert.ok(getTargetKeys, 'getTargetKeys must be defined on the mining elements config');

describe('mining element updater', () => {
  it('targets ore and raw suffixes without touching refined commodity keys', () => {
    assert.deepStrictEqual(
      getTargetKeys({ 'Element Name': 'Agricium (Ore)' }, (key) => key),
      ['items_commodities_agricium_ore_desc'],
    );
    assert.deepStrictEqual(
      getTargetKeys({ 'Element Name': 'Aphorite (Raw)' }, (key) => key),
      ['items_commodities_aphorite_raw_desc'],
    );
    assert.deepStrictEqual(
      getTargetKeys({ 'Element Name': 'Aluminium (Ore)' }, (key) => key),
      ['items_commodities_aluminum_ore_desc'],
    );
    assert.deepStrictEqual(
      getTargetKeys({ 'Element Name': 'Gold' }, (key) => key),
      [],
    );
  });

  it('builds idempotent scanner and mining behavior sections', () => {
    const row = {
      'Element Name': 'Agricium (Ore)',
      Rarity: 'uncommon',
      'Scan Signature': '3885',
      'Ground Scan Signature': '4000',
      Resistance: '0.5',
      Instability: '350',
      'Mining Difficulty': 'Difficult',
      'Volatility Note': 'Unstable charge behavior',
      'Cluster Note': 'Isolated',
      'Quality Bands': '34.6% / 58.8%',
      'Best Refinery': 'ARC-L1 Wide Forest Station (+5)',
    };

    const first = buildValue(row, '', 'Base flavor.', 'items_commodities_agricium_ore_desc');
    const second = buildValue(row, '', first, 'items_commodities_agricium_ore_desc');

    assert.strictEqual(first, second);
    assert.match(first, /\*\* Scanner Data \*\*/);
    assert.match(first, /\*\* Mining Behavior \*\*/);
    assert.match(first, /Best Refinery: ARC-L1 Wide Forest Station \(\+5\)/);
  });
});
