import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCategoryListing,
  buildProviderCoverageMatrix,
  formatCategoryListing,
  formatProviderCoverageMatrix,
} from './category-listing';

test('category listing includes representative provider families and source metadata', async () => {
  const listing = await buildCategoryListing();

  const spCoolers = listing.categories.find((entry) => entry.slug === 'sp-coolers');
  assert.deepEqual(spCoolers, {
    slug: 'sp-coolers',
    label: 'SP Coolers',
    family: 'SPViewer',
    sourceRoot: 'csv/spviewer',
    channelExpectation: 'csv/spviewer/<latest LIVE or PTU version>',
    sourceFiles: ['cooler.spviewer.csv'],
    sourceHint: undefined,
    skippedByBatch: false,
  });

  const dcPowerPlants = listing.categories.find((entry) => entry.slug === 'dc-powerplants');
  assert.deepEqual(dcPowerPlants, {
    slug: 'dc-powerplants',
    label: 'DC Power Plants',
    family: 'DataCore',
    sourceRoot: 'csv/datacore',
    channelExpectation: 'csv/datacore/<latest LIVE or PTU version>',
    sourceFiles: ['powerplant.datacore.csv'],
    sourceHint: undefined,
    skippedByBatch: false,
  });

  const missionDescriptions = listing.categories.find((entry) => entry.slug === 'mission-scmdb-descriptions');
  assert.deepEqual(missionDescriptions, {
    slug: 'mission-scmdb-descriptions',
    label: 'SCMDB mission descriptions',
    family: 'SCMDB',
    sourceRoot: 'csv/scmdb',
    channelExpectation: 'csv/scmdb/<latest LIVE or PTU version>',
    sourceFiles: ['missions/scmdb-missions.csv'],
    sourceHint: undefined,
    skippedByBatch: false,
  });

  const commodities = listing.categories.find((entry) => entry.slug === 'mission-commodities');
  assert.equal(commodities?.sourceHint, 'dynamic JSON source resolved from the selected source directory');
  assert.deepEqual(commodities?.sourceFiles, ['datacore:commodities.datacore.csv']);

  assert.deepEqual(listing.mixedSources, [
    {
      command: 'update-all --provider spviewer',
      description: 'SPViewer item categories plus SCMDB mission categories and extra SCMDB/SPViewer update steps',
      families: ['SPViewer', 'SCMDB'],
    },
    {
      command: 'update-all --provider datacore',
      description: 'DataCore item categories plus SCMDB mission categories',
      families: ['DataCore', 'SCMDB'],
    },
  ]);
});

test('formatted category listing distinguishes provider families and mixed-source modes', async () => {
  const output = formatCategoryListing(await buildCategoryListing());

  assert.match(output, /SPViewer categories:\n(?:.*\n)*? {2}sp-coolers \| SP Coolers \| files: cooler\.spviewer\.csv/);
  assert.match(
    output,
    /DataCore categories:\n(?:.*\n)*? {2}dc-powerplants \| DC Power Plants \| files: powerplant\.datacore\.csv/,
  );
  assert.match(
    output,
    /SCMDB categories:\n(?:.*\n)*? {2}mission-scmdb-descriptions \| SCMDB mission descriptions \| files: missions\/scmdb-missions\.csv/,
  );
  assert.match(
    output,
    /mission-commodities \| Commodities \| files: datacore:commodities\.datacore\.csv; dynamic JSON source resolved/,
  );
  assert.match(output, /Mixed-source batch modes:\n {2}update-all --provider spviewer \| SPViewer \+ SCMDB/);
  assert.match(output, /update-all --provider datacore \| DataCore \+ SCMDB/);
});

test('provider coverage matrix distinguishes primary, fallback, and unavailable coverage', async () => {
  const matrix = await buildProviderCoverageMatrix();

  const coolers = matrix.rows.find((row) => row.category === 'Coolers');
  assert.deepEqual(coolers, {
    category: 'Coolers',
    datacore: { status: 'primary', slug: 'dc-coolers' },
    spviewer: { status: 'legacy/fallback', slug: 'sp-coolers' },
    scmdb: { status: 'unavailable' },
  });

  const missionDescriptions = matrix.rows.find((row) => row.category === 'SCMDB mission descriptions');
  assert.deepEqual(missionDescriptions, {
    category: 'SCMDB mission descriptions',
    datacore: { status: 'unavailable' },
    spviewer: { status: 'unavailable' },
    scmdb: { status: 'primary', slug: 'mission-scmdb-descriptions' },
  });

  assert.equal(matrix.rows.some((row) => row.datacore.status === 'primary'), true);
  assert.equal(matrix.rows.some((row) => row.spviewer.status === 'legacy/fallback'), true);
  assert.equal(matrix.rows.some((row) => row.scmdb.status === 'primary'), true);
  assert.equal(matrix.rows.some((row) => row.datacore.status === 'unavailable'), true);
  assert.equal(matrix.mixedSources.length, 2);
});

test('formatted provider coverage matrix includes provider statuses and mixed-source modes', async () => {
  const output = formatProviderCoverageMatrix(await buildProviderCoverageMatrix());

  assert.match(output, /Provider coverage matrix/);
  assert.match(
    output,
    /\| Coolers \| primary \(dc-coolers\) \| legacy\/fallback \(sp-coolers\) \| unavailable \|/,
  );
  assert.match(
    output,
    /\| SCMDB mission descriptions \| unavailable \| unavailable \| primary \(mission-scmdb-descriptions\) \|/,
  );
  assert.match(output, /Legend: primary = preferred source, legacy\/fallback = supported fallback source/);
  assert.match(output, /\| update-all --provider datacore \| DataCore \+ SCMDB \|/);
});
