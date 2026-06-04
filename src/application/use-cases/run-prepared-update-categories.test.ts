import assert from 'node:assert/strict';
import test from 'node:test';
import type { ItemConfig } from '../../lib/types';
import type { UpdateCategory } from './prepare-update-categories';
import { runPreparedUpdateCategories } from './run-prepared-update-categories';

function config(label: string): ItemConfig {
  return {
    label,
    requiredColumns: [],
    descKeyMatch: () => false,
  };
}

test('runPreparedUpdateCategories enriches each category with its prepared source directory', async () => {
  const categories: UpdateCategory[] = [
    { config: config('Weapons'), csvDir: 'csv/weapons' },
    { config: config('Missions'), csvDir: 'csv/missions' },
  ];
  const calls: Array<{ label: string; csvDir?: string; dryRun?: boolean; skipBackup?: boolean }> = [];
  const started: string[] = [];

  const result = await runPreparedUpdateCategories(categories, {
    dryRun: true,
    skipBackup: true,
    onCategoryStart: ({ config }) => started.push(config.label),
    enrich: async ({ config }, options) => {
      calls.push({
        label: config.label,
        csvDir: options.csvDir,
        dryRun: options.dryRun,
        skipBackup: options.skipBackup,
      });
      return { label: config.label, summary: `${config.label} done` };
    },
  });

  assert.deepEqual(started, ['Weapons', 'Missions']);
  assert.deepEqual(calls, [
    { label: 'Weapons', csvDir: 'csv/weapons', dryRun: true, skipBackup: true },
    { label: 'Missions', csvDir: 'csv/missions', dryRun: true, skipBackup: true },
  ]);
  assert.deepEqual(
    result.results.map((entry) => entry.summary),
    ['Weapons done', 'Missions done'],
  );
  assert.deepEqual(result.errors, []);
});

test('runPreparedUpdateCategories records category errors and continues', async () => {
  const categories: UpdateCategory[] = [
    { config: config('First'), csvDir: 'csv/first' },
    { config: config('Second'), csvDir: 'csv/second' },
  ];
  const observedErrors: string[] = [];

  const result = await runPreparedUpdateCategories(categories, {
    onCategoryError: (error) => observedErrors.push(`${error.label}: ${error.message}`),
    enrich: async ({ config }) => {
      if (config.label === 'First') {
        throw new Error('source file missing', { cause: new Error('items.csv') });
      }
      return { label: config.label, summary: `${config.label} done` };
    },
  });

  assert.deepEqual(result.results, [{ label: 'Second', summary: 'Second done' }]);
  assert.deepEqual(result.errors, [{ label: 'First', message: 'source file missing', cause: 'items.csv' }]);
  assert.deepEqual(observedErrors, ['First: source file missing']);
});
