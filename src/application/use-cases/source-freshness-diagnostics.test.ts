import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { ItemConfig } from '../../enrichment/item-config';
import type { PreparedUpdateCategories, UpdateCategory } from './prepare-update-categories';
import { DATACORE_RAW_FACTS } from './category-listing';
import { buildSourceFreshnessDiagnostics, formatSourceFreshnessDiagnostics } from './source-freshness-diagnostics';

const config: ItemConfig = {
  label: 'DataCore Coolers',
  csvFile: 'coolers.datacore.csv',
  requiredColumns: [],
  descKeyMatch: () => false,
};

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'sc-source-diagnostics-'));
}

async function writeDataCoreRawFactFiles(dir: string, except: string[] = []): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  const excluded = new Set(except);
  await Promise.all(
    DATACORE_RAW_FACTS.flatMap((rawFact) => rawFact.sourceFiles)
      .filter((file) => !excluded.has(file))
      .map((file) => fs.writeFile(path.join(dir, file), 'header\nvalue\n', 'utf8')),
  );
}

function makePrepared(root: string, categories: UpdateCategory[]): PreparedUpdateCategories {
  const scmdbDir = path.join(root, 'csv', 'scmdb', '4.8.1-live.11875683');
  const itemVersionDir = path.join(root, 'csv', 'datacore', '4.8.1-live');
  return {
    categories,
    scmdbVersion: '4.8.1-live.11875683',
    scmdbDir,
    itemVersion: '4.8.1-live',
    itemVersionDir,
    missionCsvDir: scmdbDir,
  };
}

test('source freshness diagnostics summarize selected provider versions', async () => {
  const root = await makeTempDir();
  try {
    const itemVersionDir = path.join(root, 'csv', 'datacore', '4.8.1-live');
    await fs.mkdir(itemVersionDir, { recursive: true });
    await fs.writeFile(path.join(itemVersionDir, 'coolers.datacore.csv'), 'header\n', 'utf8');
    await writeDataCoreRawFactFiles(itemVersionDir);

    const diagnostics = await buildSourceFreshnessDiagnostics(
      makePrepared(root, [
        {
          config,
          csvDir: itemVersionDir,
          source: { provider: 'datacore', channel: 'LIVE', category: 'dc-coolers' },
        },
      ]),
      { provider: 'datacore' },
    );

    assert.deepEqual(
      diagnostics.versions.map((entry) => `${entry.label}:${entry.channel}:${entry.version}`),
      ['SCMDB:LIVE:4.8.1-live.11875683', 'DataCore:LIVE:4.8.1-live'],
    );
    assert.deepEqual(
      diagnostics.rawFacts?.map((entry) => [entry.slug, entry.rows, entry.csvFile]),
      DATACORE_RAW_FACTS.map((entry) => [entry.slug, 1, entry.sourceFiles[0]]),
    );
    assert.deepEqual(diagnostics.warnings, []);
    const formatted = formatSourceFreshnessDiagnostics(diagnostics);
    assert.match(formatted, /DataCore \(LIVE\): 4\.8\.1-live/);
    assert.match(formatted, /DataCore raw fact datasets:/);
    assert.match(formatted, /datacore-vehicles \| Vehicles \| 1 rows \| vehicles\.datacore\.csv/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('source freshness diagnostics warn for incomplete selected source files with provider and path context', async () => {
  const root = await makeTempDir();
  try {
    const itemVersionDir = path.join(root, 'csv', 'datacore', '4.8.1-live');
    await fs.mkdir(itemVersionDir, { recursive: true });
    await writeDataCoreRawFactFiles(itemVersionDir);
    const expectedPath = path.join(itemVersionDir, 'coolers.datacore.csv');

    const diagnostics = await buildSourceFreshnessDiagnostics(
      makePrepared(root, [
        {
          config,
          csvDir: itemVersionDir,
          source: { provider: 'datacore', channel: 'LIVE', category: 'dc-coolers' },
        },
      ]),
      { provider: 'datacore' },
    );

    assert.equal(diagnostics.warnings.length, 1);
    assert.equal(diagnostics.warnings[0].provider, 'datacore');
    assert.equal(diagnostics.warnings[0].category, 'dc-coolers');
    assert.equal(diagnostics.warnings[0].path, expectedPath);
    assert.match(diagnostics.warnings[0].message, /DataCore source data appears incomplete/);

    const formatted = formatSourceFreshnessDiagnostics(diagnostics);
    assert.match(formatted, /WARNING DataCore LIVE dc-coolers/);
    assert.match(formatted, new RegExp(expectedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('source freshness diagnostics warn for missing provider companion source files', async () => {
  const root = await makeTempDir();
  try {
    const scmdbDir = path.join(root, 'csv', 'scmdb', '4.8.1-live.11875683');
    const itemVersionDir = path.join(root, 'csv', 'datacore', '4.8.1-live');
    await fs.mkdir(scmdbDir, { recursive: true });
    await fs.mkdir(itemVersionDir, { recursive: true });
    await writeDataCoreRawFactFiles(itemVersionDir, ['commodities.datacore.csv']);
    const expectedPath = path.join(itemVersionDir, 'commodities.datacore.csv');

    const diagnostics = await buildSourceFreshnessDiagnostics(
      makePrepared(root, [
        {
          config: {
            label: 'Commodities',
            resolveJsonFile: async () => path.join(scmdbDir, 'merged-test.json'),
            sourceFiles: [{ file: 'commodities.datacore.csv', sourceDir: 'datacore' }],
            requiredColumns: [],
            descKeyMatch: () => false,
          },
          csvDir: scmdbDir,
          sourceDirs: { datacore: itemVersionDir, scmdb: scmdbDir },
          source: { provider: 'scmdb', channel: 'LIVE', category: 'mission-commodities' },
        },
      ]),
      { provider: 'datacore' },
    );

    assert.equal(diagnostics.warnings.length, 1);
    assert.equal(diagnostics.warnings[0].provider, 'datacore');
    assert.equal(diagnostics.warnings[0].category, 'mission-commodities');
    assert.equal(diagnostics.warnings[0].path, expectedPath);
    assert.match(diagnostics.warnings[0].message, /DataCore source data appears incomplete/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('source freshness diagnostics warn for missing standalone DataCore raw fact files', async () => {
  const root = await makeTempDir();
  try {
    const itemVersionDir = path.join(root, 'csv', 'datacore', '4.8.1-live');
    await writeDataCoreRawFactFiles(itemVersionDir, ['vehicles.datacore.csv']);
    const expectedPath = path.join(itemVersionDir, 'vehicles.datacore.csv');

    const diagnostics = await buildSourceFreshnessDiagnostics(makePrepared(root, []), { provider: 'datacore' });

    assert.equal(diagnostics.warnings.length, 1);
    assert.equal(diagnostics.warnings[0].provider, 'datacore');
    assert.equal(diagnostics.warnings[0].category, 'datacore-vehicles');
    assert.equal(diagnostics.warnings[0].path, expectedPath);
    assert.match(diagnostics.warnings[0].message, /DataCore raw fact data appears incomplete/);
    assert.equal(
      diagnostics.rawFacts?.some((entry) => entry.slug === 'datacore-vehicles'),
      false,
    );

    const formatted = formatSourceFreshnessDiagnostics(diagnostics);
    assert.match(formatted, /WARNING DataCore LIVE datacore-vehicles/);
    assert.match(formatted, new RegExp(expectedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('source freshness diagnostics warn for header-only DataCore raw fact files', async () => {
  const root = await makeTempDir();
  try {
    const itemVersionDir = path.join(root, 'csv', 'datacore', '4.8.1-live');
    await writeDataCoreRawFactFiles(itemVersionDir);
    const expectedPath = path.join(itemVersionDir, 'factions.datacore.csv');
    await fs.writeFile(expectedPath, 'Faction Class,Name Key\n', 'utf8');

    const diagnostics = await buildSourceFreshnessDiagnostics(makePrepared(root, []), { provider: 'datacore' });

    assert.equal(diagnostics.warnings.length, 1);
    assert.equal(diagnostics.warnings[0].provider, 'datacore');
    assert.equal(diagnostics.warnings[0].category, 'datacore-factions');
    assert.equal(diagnostics.warnings[0].path, expectedPath);
    assert.match(diagnostics.warnings[0].message, /expected at least one data row/);
    assert.equal(diagnostics.rawFacts?.find((entry) => entry.slug === 'datacore-factions')?.rows, 0);

    const formatted = formatSourceFreshnessDiagnostics(diagnostics);
    assert.match(formatted, /WARNING DataCore LIVE datacore-factions/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('source freshness diagnostics warn when a selected version looks like the wrong channel', async () => {
  const root = await makeTempDir();
  try {
    const prepared = makePrepared(root, []);
    prepared.itemVersion = '4.8.1-live';
    prepared.itemVersionDir = path.join(root, 'csv', 'datacore', '4.8.1-live');
    await writeDataCoreRawFactFiles(prepared.itemVersionDir);

    const diagnostics = await buildSourceFreshnessDiagnostics(prepared, { provider: 'datacore', ptu: true });

    assert.ok(diagnostics.warnings.some((warning) => warning.message.includes('does not look like PTU data')));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
