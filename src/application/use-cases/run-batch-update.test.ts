import assert from 'node:assert/strict';
import test from 'node:test';
import type { ItemConfig } from '../../enrichment/item-config';
import type { PreparedUpdateCategories, UpdateCategory } from './prepare-update-categories';
import { runBatchUpdate } from './run-batch-update';

const config: ItemConfig = {
  label: 'Test category',
  requiredColumns: [],
  descKeyMatch: () => false,
};

function makePrepared(): PreparedUpdateCategories {
  return {
    categories: [{ config, csvDir: 'items-dir' }],
    scmdbVersion: 'scmdb-live',
    scmdbDir: 'scmdb-dir',
    itemVersion: 'items-live',
    itemVersionDir: 'items-dir',
    missionCsvDir: 'missions-dir',
  };
}

test('runBatchUpdate prepares diagnostics and preflight before running update steps', async () => {
  const observed: string[] = [];
  const prepared = makePrepared();
  const categoryStarts: string[] = [];
  const extraStepStarts: string[] = [];

  const result = await runBatchUpdate({
    repoRoot: 'repo',
    provider: 'datacore',
    ptu: true,
    now: (() => {
      const values = [100, 125];
      return () => values.shift() ?? 125;
    })(),
    prepare: async (options) => {
      observed.push(`prepare:${options.provider}:${options.ptu}`);
      return prepared;
    },
    sourceDiagnostics: async (preparedInput, options) => {
      observed.push(`diagnostics:${preparedInput.itemVersion}:${options.provider}:${options.ptu}`);
      return {
        versions: [],
        warnings: [],
      };
    },
    scmdbDependencyAudit: async (options) => {
      observed.push(`audit:${options?.provider}`);
      return { sourceHierarchy: [], entries: [] };
    },
    preflight: async (categories) => {
      observed.push(`preflight:${categories.length}`);
    },
    backupIni: async (iniPath) => {
      observed.push(`backup:${iniPath}`);
    },
    runCategories: async (categories, options = {}) => {
      options.onCategoryStart?.(categories[0], 0);
      observed.push(`categories:${options.iniPath}:${options.skipBackup}`);
      return { results: [{ label: 'Test category', summary: 'category ok' }], errors: [] };
    },
    runExtraSteps: async (options) => {
      options.onStepStart?.('Component Titles', 0);
      observed.push(`extra:${options.missionCsvDir}:${options.datacoreVersionDir}:${options.scmdbDir}`);
      return { results: [{ label: 'Component Titles', summary: 'extra ok' }], errors: [] };
    },
    onCategoryStart: (category: UpdateCategory, index) => {
      categoryStarts.push(`${index}:${category.config.label}`);
    },
    onExtraStepStart: (label, index) => {
      extraStepStarts.push(`${index}:${label}`);
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.totalDurationMs, 25);
  assert.deepEqual(
    result.results.map((entry) => entry.summary),
    ['category ok', 'extra ok'],
  );
  assert.deepEqual(result.errors, []);
  assert.deepEqual(categoryStarts, ['0:Test category']);
  assert.deepEqual(extraStepStarts, ['0:Component Titles']);
  assert.deepEqual(observed, [
    'prepare:datacore:true',
    'diagnostics:items-live:datacore:true',
    'audit:datacore',
    'preflight:1',
    'backup:repo\\global.ini',
    'categories:repo\\global.ini:true',
    'extra:missions-dir:items-dir:scmdb-dir',
  ]);
});

test('runBatchUpdate skips backup for dry runs and returns nonzero when steps report errors', async () => {
  let backupCalled = false;

  const result = await runBatchUpdate({
    repoRoot: 'repo',
    dryRun: true,
    prepare: async () => makePrepared(),
    sourceDiagnostics: async () => ({ versions: [], warnings: [] }),
    scmdbDependencyAudit: async () => ({ sourceHierarchy: [], entries: [] }),
    preflight: async () => {},
    backupIni: async () => {
      backupCalled = true;
    },
    runCategories: async () => ({
      results: [],
      errors: [{ label: 'Test category', message: 'missing csv' }],
    }),
    runExtraSteps: async () => ({ results: [], errors: [] }),
  });

  assert.equal(backupCalled, false);
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.errors, [{ label: 'Test category', message: 'missing csv' }]);
});

test('runBatchUpdate exposes SCMDB dependency audit for datacore provider', async () => {
  const observed: string[] = [];

  const result = await runBatchUpdate({
    repoRoot: 'repo',
    provider: 'datacore',
    dryRun: true,
    prepare: async () => makePrepared(),
    sourceDiagnostics: async () => ({ versions: [], warnings: [] }),
    scmdbDependencyAudit: async (options) => {
      observed.push(`audit:${options?.provider}`);
      return {
        sourceHierarchy: ['DataCore/Data.p4k: authoritative source for game-derived raw facts.'],
        entries: [
          {
            kind: 'update category',
            slug: 'mission-scmdb-descriptions',
            label: 'SCMDB mission descriptions',
            sourceFiles: ['missions/scmdb-missions.csv'],
            classification: 'Probably extractable from DataCore with new graph traversal',
            reason: 'mission contract joins still come from SCMDB',
            migrationSlice: 'Build a first-party mission/contract extractor.',
            activeForDatacoreProvider: true,
          },
        ],
      };
    },
    preflight: async () => {},
    backupIni: async () => {},
    runCategories: async () => ({ results: [], errors: [] }),
    runExtraSteps: async () => ({ results: [], errors: [] }),
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(observed, ['audit:datacore']);
  assert.equal(result.scmdbDependencyAudit?.entries[0].slug, 'mission-scmdb-descriptions');
});
