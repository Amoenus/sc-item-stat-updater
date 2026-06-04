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
        assert.ok(err.message.includes('2 source file(s) not found'), 'should report count');
        assert.ok(err.message.includes('shields.csv'));
        assert.ok(err.message.includes('coolers.csv'));
        return true;
      });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('skips configs that use resolveJsonFile (dynamic resolution)', async () => {
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
