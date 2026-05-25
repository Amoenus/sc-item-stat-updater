import assert from 'node:assert';
import { describe, it } from 'node:test';
import config from './commodities';

// The illegal keys that are always injected when absent from the JSON.
const ILLEGAL_KEYS = [
  'items_commodities_altruciatoxin_unprocessed',
  'items_commodities_altruciatoxin',
  'items_commodities_GaspingWeevilEggs',
  'items_commodities_widow',
  'items_commodities_slam',
  'items_commodities_neon',
  'items_commodities_maze',
  'items_commodities_etam',
];

const { parseJson } = config;
assert.ok(parseJson, 'parseJson must be defined on the commodities config');

describe('commodities parseJson', () => {
  it('returns only illegal-key stubs when data is null', () => {
    const rows = parseJson(null);
    assert.strictEqual(rows.length, ILLEGAL_KEYS.length);
    for (const row of rows) {
      assert.strictEqual(row.Name, '');
      assert.ok(ILLEGAL_KEYS.map((k) => k.toLowerCase()).includes(row['Localization Key'].toLowerCase()));
    }
  });

  it('returns only illegal-key stubs when data has no resourcePools', () => {
    const rows = parseJson({});
    assert.strictEqual(rows.length, ILLEGAL_KEYS.length);
  });

  it('returns only illegal-key stubs when resourcePools is not an object', () => {
    const rows = parseJson({ resourcePools: 'bad' });
    assert.strictEqual(rows.length, ILLEGAL_KEYS.length);
  });

  it('parses valid entries from resourcePools', () => {
    const data = {
      resourcePools: {
        pool1: { nameKey: 'items_commodities_gold', name: 'Gold' },
        pool2: { nameKey: 'items_commodities_silver', name: 'Silver' },
      },
    };
    const rows = parseJson(data);
    const keys = new Set(rows.map((r) => r['Localization Key']));
    assert.ok(keys.has('items_commodities_gold'));
    assert.ok(keys.has('items_commodities_silver'));
    const gold = rows.find((r) => r['Localization Key'] === 'items_commodities_gold');
    assert.strictEqual(gold?.Name, 'Gold');
  });

  it('skips entries where nameKey is missing', () => {
    const data = {
      resourcePools: {
        good: { nameKey: 'items_commodities_gold', name: 'Gold' },
        bad: { name: 'No Key' }, // no nameKey
      },
    };
    const rows = parseJson(data);
    const keys = new Set(rows.map((r) => r['Localization Key']));
    assert.ok(keys.has('items_commodities_gold'));
    assert.ok(!keys.has('No Key'));
  });

  it('skips entries where nameKey is empty', () => {
    const data = {
      resourcePools: {
        empty: { nameKey: '', name: 'Empty Key' },
        good: { nameKey: 'items_commodities_gold', name: 'Gold' },
      },
    };
    const rows = parseJson(data);
    const keys = new Set(rows.map((r) => r['Localization Key']));
    assert.ok(!keys.has(''));
    assert.ok(keys.has('items_commodities_gold'));
  });

  it('skips entries where nameKey contains invalid characters', () => {
    const data = {
      resourcePools: {
        invalid: { nameKey: 'bad key!', name: 'Bad' },
        valid: { nameKey: 'items_commodities_gold', name: 'Gold' },
      },
    };
    const rows = parseJson(data);
    const keys = new Set(rows.map((r) => r['Localization Key']));
    assert.ok(!keys.has('bad key!'));
    assert.ok(keys.has('items_commodities_gold'));
  });

  it('always injects illegal commodity keys even when absent from JSON', () => {
    const data = {
      resourcePools: {
        pool1: { nameKey: 'items_commodities_gold', name: 'Gold' },
      },
    };
    const rows = parseJson(data);
    const keys = new Set(rows.map((r) => r['Localization Key'].toLowerCase()));
    for (const illegalKey of ILLEGAL_KEYS) {
      assert.ok(keys.has(illegalKey.toLowerCase()), `Expected illegal key ${illegalKey} to be present`);
    }
  });

  it('does not duplicate illegal keys already present in resourcePools', () => {
    const data = {
      resourcePools: {
        widow: { nameKey: 'items_commodities_widow', name: 'Widow' },
      },
    };
    const rows = parseJson(data);
    const widowRows = rows.filter((r) => r['Localization Key'].toLowerCase() === 'items_commodities_widow');
    assert.strictEqual(widowRows.length, 1, 'Illegal key should appear exactly once');
  });
});
