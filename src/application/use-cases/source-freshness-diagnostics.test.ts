import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { ItemConfig } from '../../enrichment/item-config';
import type { PreparedUpdateCategories, UpdateCategory } from './prepare-update-categories';
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
    assert.deepEqual(diagnostics.warnings, []);
    assert.match(formatSourceFreshnessDiagnostics(diagnostics), /DataCore \(LIVE\): 4\.8\.1-live/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('source freshness diagnostics warn for incomplete selected source files with provider and path context', async () => {
  const root = await makeTempDir();
  try {
    const itemVersionDir = path.join(root, 'csv', 'datacore', '4.8.1-live');
    await fs.mkdir(itemVersionDir, { recursive: true });
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

test('source freshness diagnostics warn when a selected version looks like the wrong channel', async () => {
  const root = await makeTempDir();
  try {
    const prepared = makePrepared(root, []);
    prepared.itemVersion = '4.8.1-live';
    prepared.itemVersionDir = path.join(root, 'csv', 'datacore', '4.8.1-live');

    const diagnostics = await buildSourceFreshnessDiagnostics(prepared, { provider: 'datacore', ptu: true });

    assert.ok(diagnostics.warnings.some((warning) => warning.message.includes('does not look like PTU data')));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
