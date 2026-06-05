import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import config, { buildCommodityRowsFromSources, compareCommodityCoverage } from './commodities';

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

  it('prefers DataCore commodity keys and keeps SCMDB rows only as fallback', () => {
    const rows = buildCommodityRowsFromSources(
      [
        {
          'Name Key': 'items_commodities_gold',
          'Description Key': 'items_commodities_gold_desc',
          'Display Type Key': 'items_commodities_type_metal',
        },
      ],
      [
        { 'Localization Key': 'items_commodities_gold', Name: 'SCMDB Gold' },
        { 'Localization Key': 'items_commodities_silver', Name: 'Silver' },
      ],
    );

    assert.deepStrictEqual(
      rows.map((row) => [row['Localization Key'], row.Source, row.Name]),
      [
        ['items_commodities_gold', 'DataCore', ''],
        ['items_commodities_gold_desc', 'DataCore', ''],
        ['items_commodities_type_metal', 'DataCore', ''],
        ['items_commodities_silver', 'SCMDB', 'Silver'],
      ],
    );
  });

  it('compares DataCore and SCMDB commodity coverage for diagnostics', () => {
    const coverage = compareCommodityCoverage(
      [{ 'Name Key': 'items_commodities_gold', 'Display Type Key': 'items_commodities_type_metal' }],
      [
        { 'Localization Key': 'items_commodities_gold', Name: 'Gold' },
        { 'Localization Key': 'items_commodities_silver', Name: 'Silver' },
      ],
    );

    assert.strictEqual(coverage.datacoreKeys, 2);
    assert.strictEqual(coverage.scmdbKeys, 2);
    assert.strictEqual(coverage.common, 1);
    assert.deepStrictEqual(coverage.datacoreOnly, ['items_commodities_type_metal']);
    assert.deepStrictEqual(coverage.scmdbOnly, ['items_commodities_silver']);
  });

  it('loads DataCore commodities beside SCMDB resource-pool fallback rows', async () => {
    assert.ok(config.loadSourceData, 'loadSourceData must be defined on the commodities config');
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'commodity-sources-'));
    const scmdbDir = path.join(dir, 'scmdb');
    const datacoreDir = path.join(dir, 'datacore');
    await fs.mkdir(scmdbDir, { recursive: true });
    await fs.mkdir(datacoreDir, { recursive: true });
    await fs.writeFile(
      path.join(scmdbDir, 'merged-test.json'),
      JSON.stringify({
        resourcePools: {
          gold: { nameKey: 'items_commodities_gold', name: 'SCMDB Gold' },
          silver: { nameKey: 'items_commodities_silver', name: 'Silver' },
        },
      }),
      'utf8',
    );
    await fs.writeFile(
      path.join(datacoreDir, 'commodities.datacore.csv'),
      [
        'Entity Class,Name Key,Description Key,Display Name Key,Display Description Key,Display Type Key',
        'gold,items_commodities_gold,items_commodities_gold_desc,,,items_commodities_type_metal',
      ].join('\n'),
      'utf8',
    );

    const rows = await config.loadSourceData({ csvDir: scmdbDir, sourceDirs: { datacore: datacoreDir, scmdb: scmdbDir } });

    assert.equal(rows.find((row) => row['Localization Key'] === 'items_commodities_gold')?.Source, 'DataCore');
    assert.equal(rows.find((row) => row['Localization Key'] === 'items_commodities_gold')?.Name, '');
    assert.equal(rows.find((row) => row['Localization Key'] === 'items_commodities_gold_desc')?.Source, 'DataCore');
    assert.equal(rows.find((row) => row['Localization Key'] === 'items_commodities_type_metal')?.Source, 'DataCore');
    assert.equal(rows.find((row) => row['Localization Key'] === 'items_commodities_silver')?.Source, 'SCMDB');
    assert.equal(rows.find((row) => row['Localization Key'] === 'items_commodities_silver')?.Name, 'Silver');
  });

  it('loads dynamic SCMDB commodity JSON when source dirs are relative', async () => {
    assert.ok(config.loadSourceData, 'loadSourceData must be defined on the commodities config');
    const dir = await fs.mkdtemp(path.join(process.cwd(), '.tmp-commodity-relative-'));
    try {
      const scmdbDir = path.join(dir, 'scmdb');
      const datacoreDir = path.join(dir, 'datacore');
      await fs.mkdir(scmdbDir, { recursive: true });
      await fs.mkdir(datacoreDir, { recursive: true });
      await fs.writeFile(
        path.join(scmdbDir, 'merged-test.json'),
        JSON.stringify({
          resourcePools: {
            gold: { nameKey: 'items_commodities_gold', name: 'Gold' },
          },
        }),
        'utf8',
      );
      await fs.writeFile(
        path.join(datacoreDir, 'commodities.datacore.csv'),
        ['Entity Class,Name Key,Description Key,Display Name Key,Display Description Key,Display Type Key'].join('\n'),
        'utf8',
      );

      const relativeScmdbDir = path.relative(process.cwd(), scmdbDir);
      const relativeDatacoreDir = path.relative(process.cwd(), datacoreDir);
      const rows = await config.loadSourceData({
        csvDir: relativeScmdbDir,
        sourceDirs: { datacore: relativeDatacoreDir, scmdb: relativeScmdbDir },
      });

      assert.equal(rows.find((row) => row['Localization Key'] === 'items_commodities_gold')?.Name, 'Gold');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
