import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { ItemConfig } from '../../enrichment/item-config';
import type { UpdateCategory } from './prepare-update-categories';
import { runPreparedUpdateCategories } from './run-prepared-update-categories';

function config(label: string): ItemConfig {
  return {
    label,
    requiredColumns: [],
    descKeyMatch: () => false,
  };
}

function matchingConfig(label: string, descKeyMatch: ItemConfig['descKeyMatch']): ItemConfig {
  return {
    label,
    requiredColumns: [],
    descKeyMatch,
  };
}

test('runPreparedUpdateCategories enriches each category with its prepared source directory', async () => {
  const categories: UpdateCategory[] = [
    { config: config('Weapons'), csvDir: 'csv/weapons', sourceDirs: { datacore: 'csv/datacore', scmdb: 'csv/scmdb' } },
    { config: config('Missions'), csvDir: 'csv/missions' },
  ];
  const calls: Array<{
    label: string;
    csvDir?: string;
    datacoreDir?: string;
    dryRun?: boolean;
    skipBackup?: boolean;
  }> = [];
  const started: string[] = [];

  const result = await runPreparedUpdateCategories(categories, {
    dryRun: true,
    skipBackup: true,
    onCategoryStart: ({ config }) => started.push(config.label),
    enrich: async ({ config }, options) => {
      calls.push({
        label: config.label,
        csvDir: options.csvDir,
        datacoreDir: options.sourceDirs?.datacore,
        dryRun: options.dryRun,
        skipBackup: options.skipBackup,
      });
      return { label: config.label, summary: `${config.label} done` };
    },
  });

  assert.deepEqual(started, ['Weapons', 'Missions']);
  assert.deepEqual(calls, [
    { label: 'Weapons', csvDir: 'csv/weapons', datacoreDir: 'csv/datacore', dryRun: true, skipBackup: true },
    { label: 'Missions', csvDir: 'csv/missions', datacoreDir: undefined, dryRun: true, skipBackup: true },
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

test('runPreparedUpdateCategories logs descKeyMatch overlaps during dry runs', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prepared-overlap-test-'));
  try {
    const iniPath = path.join(dir, 'global.ini');
    await fs.writeFile(iniPath, 'item_Name_Widget=Widget\nitem_Desc_Widget=Old text\nitem_Title_Widget=Title');
    const categories: UpdateCategory[] = [
      {
        config: matchingConfig('Broad Desc', (key) => key.includes('desc')),
        csvDir: path.join(dir, 'broad'),
      },
      {
        config: matchingConfig('Widget Desc', (key) => key.includes('desc_widget')),
        csvDir: path.join(dir, 'widget'),
      },
      {
        config: matchingConfig('Titles', (key) => key.includes('title')),
        csvDir: path.join(dir, 'titles'),
      },
    ];
    const warnings: Array<{ message: string; attributes: unknown }> = [];

    await runPreparedUpdateCategories(categories, {
      dryRun: true,
      iniPath,
      descKeyMatchLogger: {
        warn: (message, attributes) => warnings.push({ message, attributes }),
      },
      enrich: async ({ config }) => ({ label: config.label, summary: `${config.label} done` }),
    });

    assert.deepEqual(warnings, [
      {
        message: 'descKeyMatch overlap detected',
        attributes: { key: 'item_Desc_Widget', matches: 'Broad Desc, Widget Desc', matchCount: 2 },
      },
    ]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
