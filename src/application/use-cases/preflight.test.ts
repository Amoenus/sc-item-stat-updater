import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { ItemConfig } from '../../enrichment/item-config';
import { preflightCheckConfigs } from './update-planning';

/** Creates a minimal ItemConfig with only the fields needed for preflight. */
function makeConfig(overrides: Partial<ItemConfig>): ItemConfig {
  return {
    label: 'Test Config',
    requiredColumns: [],
    descKeyMatch: () => false,
    ...overrides,
  } as ItemConfig;
}

/** Writes an empty file at the given path, creating parent dirs as needed. */
async function touch(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, '');
}

describe('preflightCheckConfigs', () => {
  it('resolves successfully when all declared files exist', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-test-'));
    try {
      await touch(path.join(dir, 'items.csv'));
      await touch(path.join(dir, 'lookup.csv'));

      const categories = [
        {
          config: makeConfig({ csvFile: 'items.csv', lookupCsvFile: 'lookup.csv', label: 'Items' }),
          csvDir: dir,
        },
      ];

      await assert.doesNotReject(preflightCheckConfigs(categories));
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('throws when a csvFile is missing', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-test-'));
    try {
      const categories = [
        {
          config: makeConfig({ csvFile: 'missing.csv', label: 'Shields' }),
          csvDir: dir,
        },
      ];

      await assert.rejects(preflightCheckConfigs(categories), (err: Error) => {
        assert.ok(err.message.includes('Preflight check failed'), 'should mention preflight check');
        assert.ok(err.message.includes('missing.csv'), 'should name the missing file');
        assert.ok(err.message.includes('Shields'), 'should name the config label');
        return true;
      });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('throws when a lookupCsvFile is missing', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-test-'));
    try {
      await touch(path.join(dir, 'items.csv'));

      const categories = [
        {
          config: makeConfig({ csvFile: 'items.csv', lookupCsvFile: 'lookup-missing.csv', label: 'Guns' }),
          csvDir: dir,
        },
      ];

      await assert.rejects(preflightCheckConfigs(categories), (err: Error) => {
        assert.ok(err.message.includes('lookup-missing.csv'));
        return true;
      });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('reports provider, channel, category, path, and command for a missing DataCore item source', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-test-'));
    try {
      const expectedPath = path.join(dir, 'coolers.datacore.csv');
      const categories = [
        {
          config: makeConfig({ csvFile: 'coolers.datacore.csv', label: 'DataCore Coolers' }),
          csvDir: dir,
          source: { provider: 'datacore' as const, channel: 'LIVE' as const, category: 'dc-coolers' },
        },
      ];

      await assert.rejects(preflightCheckConfigs(categories), (err: Error) => {
        assert.ok(err.message.includes('DataCore'), 'should name the provider');
        assert.ok(err.message.includes('LIVE'), 'should name the channel');
        assert.ok(err.message.includes('dc-coolers'), 'should name the category');
        assert.ok(err.message.includes(expectedPath), 'should include the expected path');
        assert.ok(err.message.includes('npm run scrape:datacore'), 'should suggest the DataCore scraper');
        return true;
      });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('reports provider, channel, category, path, and command for a missing SCMDB mission source', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-test-'));
    try {
      const expectedPath = path.join(dir, 'missions.csv');
      const categories = [
        {
          config: makeConfig({ csvFile: 'missions.csv', label: 'Mission Descriptions' }),
          csvDir: dir,
          source: { provider: 'scmdb' as const, channel: 'PTU' as const, category: 'mission-descriptions' },
        },
      ];

      await assert.rejects(preflightCheckConfigs(categories), (err: Error) => {
        assert.ok(err.message.includes('SCMDB'), 'should name the provider');
        assert.ok(err.message.includes('PTU'), 'should name the channel');
        assert.ok(err.message.includes('mission-descriptions'), 'should name the category');
        assert.ok(err.message.includes(expectedPath), 'should include the expected path');
        assert.ok(err.message.includes('npm run scrape:scmdb -- --ptu'), 'should suggest the SCMDB PTU scraper');
        return true;
      });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('reports all missing files in a single error', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-test-'));
    try {
      const categories = [
        {
          config: makeConfig({ csvFile: 'shields.csv', label: 'Shields' }),
          csvDir: dir,
        },
        {
          config: makeConfig({ csvFile: 'coolers.csv', label: 'Coolers' }),
          csvDir: dir,
        },
      ];

      await assert.rejects(preflightCheckConfigs(categories), (err: Error) => {
        assert.ok(err.message.includes('2 source file issue(s)'), 'should report count');
        assert.ok(err.message.includes('shields.csv'));
        assert.ok(err.message.includes('coolers.csv'));
        return true;
      });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('skips dynamic JSON primary sources with no declared companion files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-test-'));
    try {
      // No files created — resolveJsonFile config should be skipped entirely
      const categories = [
        {
          config: makeConfig({
            resolveJsonFile: async () => path.join(dir, 'merged-does-not-exist.json'),
            label: 'Commodities',
          }),
          csvDir: dir,
        },
      ];

      await assert.doesNotReject(preflightCheckConfigs(categories));
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('checks declared DataCore companion files for dynamic SCMDB configs', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-test-'));
    try {
      const scmdbDir = path.join(dir, 'scmdb');
      const datacoreDir = path.join(dir, 'datacore');
      await fs.mkdir(scmdbDir, { recursive: true });
      await fs.mkdir(datacoreDir, { recursive: true });
      const expectedPath = path.join(datacoreDir, 'commodities.datacore.csv');

      const categories = [
        {
          config: makeConfig({
            resolveJsonFile: async () => path.join(scmdbDir, 'merged-test.json'),
            sourceFiles: [{ file: 'commodities.datacore.csv', sourceDir: 'datacore' }],
            label: 'Commodities',
          }),
          csvDir: scmdbDir,
          sourceDirs: { datacore: datacoreDir, scmdb: scmdbDir },
          source: { provider: 'scmdb' as const, channel: 'LIVE' as const, category: 'mission-commodities' },
        },
      ];

      await assert.rejects(preflightCheckConfigs(categories), (err: Error) => {
        assert.ok(err.message.includes('DataCore'), 'should report the companion file provider');
        assert.ok(err.message.includes('commodities.datacore.csv'));
        assert.ok(err.message.includes(expectedPath));
        assert.ok(err.message.includes('npm run scrape:datacore'));
        return true;
      });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('checks standalone DataCore raw fact files when requested', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-test-'));
    try {
      const expectedPath = path.join(dir, 'vehicles.datacore.csv');

      await assert.rejects(
        preflightCheckConfigs([], {
          rawFacts: [
            {
              rawFact: {
                slug: 'datacore-vehicles',
                label: 'Vehicles',
                family: 'DataCore',
                sourceRoot: 'csv/datacore',
                sourceFiles: ['vehicles.datacore.csv'],
                description: 'first-party vehicle labels',
              },
              baseDir: dir,
              channel: 'LIVE',
            },
          ],
        }),
        (err: Error) => {
          assert.ok(err.message.includes('DataCore'), 'should name the provider');
          assert.ok(err.message.includes('LIVE'), 'should name the channel');
          assert.ok(err.message.includes('datacore-vehicles'), 'should name the raw fact slug');
          assert.ok(err.message.includes(expectedPath), 'should include the expected path');
          assert.ok(err.message.includes('npm run scrape:datacore'), 'should suggest the DataCore scraper');
          return true;
        },
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects standalone DataCore raw fact files with no data rows', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-test-'));
    try {
      const expectedPath = path.join(dir, 'factions.datacore.csv');
      await touch(expectedPath);
      await fs.writeFile(expectedPath, 'Faction Class,Name Key\n', 'utf8');

      await assert.rejects(
        preflightCheckConfigs([], {
          rawFacts: [
            {
              rawFact: {
                slug: 'datacore-factions',
                label: 'Factions and reputation',
                family: 'DataCore',
                sourceRoot: 'csv/datacore',
                sourceFiles: ['factions.datacore.csv'],
                description: 'first-party faction flags',
              },
              baseDir: dir,
              channel: 'LIVE',
            },
          ],
        }),
        (err: Error) => {
          assert.ok(err.message.includes('DataCore'), 'should name the provider');
          assert.ok(err.message.includes('datacore-factions'), 'should name the raw fact slug');
          assert.ok(err.message.includes(expectedPath), 'should include the expected path');
          assert.ok(err.message.includes('expected at least one data row'), 'should report the empty file issue');
          assert.ok(err.message.includes('npm run scrape:datacore'), 'should suggest the DataCore scraper');
          return true;
        },
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('deduplicates missing DataCore files shared by category companions and raw facts', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-test-'));
    try {
      const datacoreDir = path.join(dir, 'datacore');
      const scmdbDir = path.join(dir, 'scmdb');
      await fs.mkdir(datacoreDir, { recursive: true });
      await fs.mkdir(scmdbDir, { recursive: true });

      const categories = [
        {
          config: makeConfig({
            resolveJsonFile: async () => path.join(scmdbDir, 'merged-test.json'),
            sourceFiles: [{ file: 'commodities.datacore.csv', sourceDir: 'datacore' }],
            label: 'Commodities',
          }),
          csvDir: scmdbDir,
          sourceDirs: { datacore: datacoreDir, scmdb: scmdbDir },
          source: { provider: 'scmdb' as const, channel: 'LIVE' as const, category: 'mission-commodities' },
        },
      ];

      await assert.rejects(
        preflightCheckConfigs(categories, {
          rawFacts: [
            {
              rawFact: {
                slug: 'datacore-commodities',
                label: 'Commodities',
                family: 'DataCore',
                sourceRoot: 'csv/datacore',
                sourceFiles: ['commodities.datacore.csv'],
                description: 'first-party commodity identity',
              },
              baseDir: datacoreDir,
              channel: 'LIVE',
            },
          ],
        }),
        /1 source file issue\(s\)/,
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('skips provider companion files when that provider source directory is unavailable', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-test-'));
    try {
      const categories = [
        {
          config: makeConfig({
            sourceFiles: [{ file: 'commodities.datacore.csv', sourceDir: 'datacore' }],
            label: 'Commodities',
          }),
          csvDir: dir,
          sourceDirs: { scmdb: dir },
        },
      ];

      await assert.doesNotReject(preflightCheckConfigs(categories));
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('uses declared custom loader source files instead of csvFile for preflight', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-test-'));
    const datacoreDir = path.join(dir, 'datacore');
    try {
      await touch(path.join(datacoreDir, 'mining-provider-presets.datacore.csv'));
      const categories = [
        {
          config: makeConfig({
            csvFile: 'mining-locations.csv',
            sourceFiles: [{ file: 'mining-provider-presets.datacore.csv', sourceDir: 'datacore' }],
            loadSourceData: async () => [],
            label: 'Mining locations',
          }),
          csvDir: dir,
          sourceDirs: { datacore: datacoreDir },
        },
      ];

      await assert.doesNotReject(preflightCheckConfigs(categories));
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('resolves successfully for an empty categories list', async () => {
    await assert.doesNotReject(preflightCheckConfigs([]));
  });

  it('skips configs with no declared source files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-test-'));
    try {
      const categories = [
        {
          config: makeConfig({ label: 'No Files' }), // no csvFile / jsonFile / lookupCsvFile
          csvDir: dir,
        },
      ];
      await assert.doesNotReject(preflightCheckConfigs(categories));
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
