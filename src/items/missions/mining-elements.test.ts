import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import config, { buildMiningElementRowsFromSources, compareMiningElementCoverage } from './mining-elements';

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

  it('overlays DataCore raw behavior fields while preserving SCMDB derived insight fields', () => {
    const rows = buildMiningElementRowsFromSources(
      [
        {
          'Element Name': 'Agricium (Ore)',
          'Inferred Description Key': 'items_commodities_agricium_ore_desc',
          Instability: '350',
          Resistance: '0.5',
          'Optimal Window Midpoint': '0.5',
          'Optimal Window Randomness': '0.15',
          'Optimal Window Thinness': '2',
          'Explosion Multiplier': '4',
          'Cluster Factor': '0.2',
        },
      ],
      [
        {
          'Element Name': 'Agricium (Ore)',
          Rarity: 'uncommon',
          'Scan Signature': '3885',
          Resistance: 'old',
          Instability: 'old',
          'Best Refinery': 'ARC-L1 Wide Forest Station (+5)',
        },
        {
          'Element Name': 'Titanium (Ore)',
          Rarity: 'common',
          'Scan Signature': '1000',
          Resistance: '0.1',
          Instability: '10',
        },
      ],
    );

    const agricium = rows.find((row) => row['Element Name'] === 'Agricium (Ore)');
    assert.ok(agricium);
    assert.strictEqual(agricium.Source, 'DataCore+SCMDB');
    assert.strictEqual(agricium.Resistance, '0.5');
    assert.strictEqual(agricium.Instability, '350');
    assert.strictEqual(agricium.Rarity, 'uncommon');
    assert.strictEqual(agricium['Scan Signature'], '3885');
    assert.strictEqual(agricium['Best Refinery'], 'ARC-L1 Wide Forest Station (+5)');

    const titanium = rows.find((row) => row['Element Name'] === 'Titanium (Ore)');
    assert.ok(titanium);
    assert.strictEqual(titanium.Source, 'SCMDB');
  });

  it('compares DataCore and SCMDB mining element coverage for diagnostics', () => {
    const coverage = compareMiningElementCoverage(
      [
        { 'Inferred Description Key': 'items_commodities_agricium_ore_desc' },
        { 'Inferred Description Key': 'items_commodities_aslarite_raw_desc' },
      ],
      [
        { 'Element Name': 'Agricium (Ore)' },
        { 'Element Name': 'Titanium (Ore)' },
      ],
    );

    assert.strictEqual(coverage.datacoreKeys, 2);
    assert.strictEqual(coverage.scmdbKeys, 2);
    assert.strictEqual(coverage.common, 1);
    assert.deepStrictEqual(coverage.datacoreOnly, ['items_commodities_aslarite_raw_desc']);
    assert.deepStrictEqual(coverage.scmdbOnly, ['items_commodities_titanium_ore_desc']);
  });

  it('loads DataCore mining elements beside SCMDB mining insight fallback rows', async () => {
    assert.ok(config.loadSourceData, 'loadSourceData must be defined on the mining elements config');
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mining-element-sources-'));
    const scmdbDir = path.join(dir, 'scmdb');
    const datacoreDir = path.join(dir, 'datacore');
    await fs.mkdir(scmdbDir, { recursive: true });
    await fs.mkdir(datacoreDir, { recursive: true });
    await fs.writeFile(
      path.join(scmdbDir, 'mining-elements.csv'),
      [
        'Element Name,Rarity,Scan Signature,Resistance,Instability,Best Refinery',
        'Agricium (Ore),uncommon,3885,old,old,ARC-L1 Wide Forest Station (+5)',
        'Titanium (Ore),common,1000,0.1,10,',
      ].join('\n'),
      'utf8',
    );
    await fs.writeFile(
      path.join(datacoreDir, 'mining-elements.datacore.csv'),
      [
        'Element Class,Element Name,Inferred Description Key,Resource Type GUID,Instability,Resistance,Optimal Window Midpoint,Optimal Window Randomness,Optimal Window Thinness,Explosion Multiplier,Cluster Factor',
        'Agricium_Ore,Agricium (Ore),items_commodities_agricium_ore_desc,guid,350,0.5,0.5,0.15,2,4,0.2',
      ].join('\n'),
      'utf8',
    );

    const rows = await config.loadSourceData({ csvDir: scmdbDir, sourceDirs: { datacore: datacoreDir, scmdb: scmdbDir } });
    const agricium = rows.find((row) => row['Element Name'] === 'Agricium (Ore)');

    assert.equal(agricium?.Source, 'DataCore+SCMDB');
    assert.equal(agricium?.Resistance, '0.5');
    assert.equal(agricium?.Instability, '350');
    assert.equal(agricium?.Rarity, 'uncommon');
    assert.equal(rows.find((row) => row['Element Name'] === 'Titanium (Ore)')?.Source, 'SCMDB');
  });
});
