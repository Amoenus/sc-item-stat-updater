import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import config, { buildCommodityRowsFromSources } from './commodities';

describe('commodities source loading', () => {
  it('builds commodity rows from DataCore key columns only', () => {
    const rows = buildCommodityRowsFromSources([
      {
        'Name Key': 'items_commodities_gold',
        'Description Key': 'items_commodities_gold_desc',
        'Display Type Key': 'items_commodities_type_metal',
      },
    ]);

    assert.deepStrictEqual(
      rows.map((row) => [row['Localization Key'], row.Source, row.Name]),
      [
        ['items_commodities_gold', 'DataCore', ''],
        ['items_commodities_gold_desc', 'DataCore', ''],
        ['items_commodities_type_metal', 'DataCore', ''],
      ],
    );
  });

  it('marks commodity name rows as warnings when DataCore classifies the source commodity as vice', () => {
    const rows = buildCommodityRowsFromSources([
      {
        'Name Key': 'items_commodities_neon',
        'Description Key': 'items_commodities_neon_desc',
        'Display Name Key': 'items_commodities_neon',
        'Display Type Key': 'items_commodities_type_vice',
        'Record Path': 'libs/foundry/records/entities/commodities/vice/neon.xml',
      },
    ]);

    assert.deepStrictEqual(
      rows.map((row) => [row['Localization Key'], row['Commodity Field'], row['Warning Tag']]),
      [
        ['items_commodities_neon', 'Name Key', '1'],
        ['items_commodities_neon_desc', 'Description Key', ''],
        ['items_commodities_type_vice', 'Display Type Key', ''],
      ],
    );
  });

  it('marks commodity name rows as warnings when DataCore law relationships classify the source commodity as controlled', () => {
    const rows = buildCommodityRowsFromSources([
      {
        'Name Key': 'items_commodities_DCSR2',
        'Description Key': 'items_commodities_DCSR2_desc',
        'Display Name Key': 'items_commodities_DCSR2',
        'Display Type Key': 'items_commodities_type_agriculturalSupply',
        'Controlled Substance Jurisdictions': 'Jurisdictions_Name_004',
        'Legality Warning Source': 'controlled-substance',
        'Record Path': 'libs/foundry/records/entities/commodities/agriculturalsupplies/dcsr2.xml',
      },
    ]);

    assert.deepStrictEqual(
      rows.map((row) => [row['Localization Key'], row['Commodity Field'], row['Warning Tag']]),
      [
        ['items_commodities_DCSR2', 'Name Key', '1'],
        ['items_commodities_DCSR2_desc', 'Description Key', ''],
        ['items_commodities_type_agriculturalSupply', 'Display Type Key', ''],
      ],
    );
  });

  it('does not warn non-vice commodity rows from static key names', () => {
    const rows = buildCommodityRowsFromSources([
      {
        'Name Key': 'items_commodities_GaspingWeevilEggs',
        'Description Key': 'items_commodities_GaspingWeevilEggs_desc',
        'Display Type Key': 'items_commodities_type_food',
        'Record Path': 'libs/foundry/records/entities/commodities/food/gaspingweevileggs.xml',
      },
    ]);

    assert.equal(rows.find((row) => row['Localization Key'] === 'items_commodities_GaspingWeevilEggs')?.['Warning Tag'], '');
  });

  it('builds warning-prefixed commodity labels from source-derived warning tags', () => {
    assert.equal(
      config.buildValue?.(
        { 'Localization Key': 'items_commodities_neon', 'Warning Tag': '1' },
        '',
        'Neon',
        'items_commodities_neon',
      ),
      '<EM3>[!]</EM3> Neon',
    );
    assert.equal(
      config.buildValue?.(
        { 'Localization Key': 'items_commodities_GaspingWeevilEggs', 'Warning Tag': '' },
        '',
        '<EM3>[!]</EM3> Gasping Weevil Eggs',
        'items_commodities_GaspingWeevilEggs',
      ),
      'Gasping Weevil Eggs',
    );
  });

  it('deduplicates keys repeated across DataCore columns', () => {
    const rows = buildCommodityRowsFromSources([
      {
        'Name Key': 'items_commodities_gold',
        'Display Name Key': 'items_commodities_gold',
        'Description Key': 'items_commodities_gold_desc',
      },
    ]);

    assert.deepStrictEqual(
      rows.map((row) => row['Localization Key']),
      ['items_commodities_gold', 'items_commodities_gold_desc'],
    );
  });

  it('loads DataCore commodities without SCMDB resource-pool fallback rows', async () => {
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

    const rows = await config.loadSourceData({
      csvDir: scmdbDir,
      sourceDirs: { datacore: datacoreDir, scmdb: scmdbDir },
    });

    assert.equal(rows.find((row) => row['Localization Key'] === 'items_commodities_gold')?.Source, 'DataCore');
    assert.equal(rows.find((row) => row['Localization Key'] === 'items_commodities_gold')?.Name, '');
    assert.equal(rows.find((row) => row['Localization Key'] === 'items_commodities_gold_desc')?.Source, 'DataCore');
    assert.equal(rows.find((row) => row['Localization Key'] === 'items_commodities_type_metal')?.Source, 'DataCore');
    assert.equal(
      rows.find((row) => row['Localization Key'] === 'items_commodities_silver'),
      undefined,
    );
  });

  it('loads relative DataCore commodity CSV without requiring SCMDB JSON', async () => {
    assert.ok(config.loadSourceData, 'loadSourceData must be defined on the commodities config');
    const dir = await fs.mkdtemp(path.join(process.cwd(), '.tmp-commodity-relative-'));
    try {
      const scmdbDir = path.join(dir, 'scmdb');
      const datacoreDir = path.join(dir, 'datacore');
      await fs.mkdir(scmdbDir, { recursive: true });
      await fs.mkdir(datacoreDir, { recursive: true });
      await fs.writeFile(
        path.join(datacoreDir, 'commodities.datacore.csv'),
        [
          'Entity Class,Name Key,Description Key,Display Name Key,Display Description Key,Display Type Key',
          'gold,items_commodities_gold,items_commodities_gold_desc,,,items_commodities_type_metal',
        ].join('\n'),
        'utf8',
      );

      const relativeScmdbDir = path.relative(process.cwd(), scmdbDir);
      const relativeDatacoreDir = path.relative(process.cwd(), datacoreDir);
      const rows = await config.loadSourceData({
        csvDir: relativeScmdbDir,
        sourceDirs: { datacore: relativeDatacoreDir, scmdb: relativeScmdbDir },
      });

      assert.equal(rows.find((row) => row['Localization Key'] === 'items_commodities_gold')?.Source, 'DataCore');
      assert.equal(rows.find((row) => row['Localization Key'] === 'items_commodities_gold_desc')?.Source, 'DataCore');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
