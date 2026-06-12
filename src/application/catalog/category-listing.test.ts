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

  const missionDescriptions = listing.categories.find((entry) => entry.slug === 'mission-datacore-descriptions');
  assert.deepEqual(missionDescriptions, {
    slug: 'mission-datacore-descriptions',
    label: 'DataCore mission descriptions',
    family: 'DataCore',
    sourceRoot: 'csv/datacore',
    channelExpectation: 'csv/datacore/<latest LIVE or PTU version>',
    sourceFiles: [
      'datacore:contract-generator-intel.datacore.csv',
      'datacore:mission-contract-intel.datacore.csv',
      'optional:datacore:contract-hauling-summary.datacore.csv',
      'datacore:contract-generators.datacore.csv',
      'datacore:blueprint-pools.datacore.csv',
      'datacore:crafting-blueprints.datacore.csv',
    ],
    sourceHint: undefined,
    skippedByBatch: false,
  });

  const commodities = listing.categories.find((entry) => entry.slug === 'mission-commodities');
  assert.equal(commodities?.family, 'DataCore');
  assert.equal(commodities?.sourceRoot, 'csv/datacore');
  assert.equal(commodities?.sourceHint, undefined);
  assert.deepEqual(commodities?.sourceFiles, ['datacore:commodities.datacore.csv']);

  const miningElements = listing.categories.find((entry) => entry.slug === 'mission-mining-elements');
  assert.equal(miningElements?.family, 'DataCore');
  assert.equal(miningElements?.sourceFiles.includes('optional:scmdb:mining-elements.csv'), true);

  const scmdbSlugs = listing.categories.filter((entry) => entry.family === 'SCMDB').map((entry) => entry.slug);
  assert.deepEqual(scmdbSlugs, []);

  assert.deepEqual(
    listing.rawFacts.map((entry) => [entry.slug, entry.sourceFiles[0]]),
    [
      ['datacore-contract-generators', 'contract-generators.datacore.csv'],
      ['datacore-contract-generator-intel', 'contract-generator-intel.datacore.csv'],
      ['datacore-contract-templates', 'contract-templates.datacore.csv'],
      ['datacore-contract-template-hauling', 'contract-template-hauling.datacore.csv'],
      ['datacore-contract-generator-hauling', 'contract-hauling-summary.datacore.csv'],
      ['datacore-commodities', 'commodities.datacore.csv'],
      ['datacore-vehicles', 'vehicles.datacore.csv'],
      ['datacore-manufacturers', 'manufacturers.datacore.csv'],
      ['datacore-factions', 'factions.datacore.csv'],
      ['datacore-location-labels', 'location-labels.datacore.csv'],
      ['datacore-mission-localization', 'mission-localization.datacore.csv'],
      ['datacore-mission-brokers', 'mission-brokers.datacore.csv'],
      ['datacore-mission-contract-intel', 'mission-contract-intel.datacore.csv'],
      ['datacore-mining-location-labels', 'mining-location-labels.datacore.csv'],
    ],
  );

  assert.deepEqual(listing.mixedSources, [
    {
      command: 'update-all',
      description: 'DataCore item categories plus remaining SCMDB-derived mission bridges',
      families: ['DataCore', 'SCMDB'],
    },
  ]);
});

test('formatted category listing distinguishes provider families and mixed-source modes', async () => {
  const output = formatCategoryListing(await buildCategoryListing());

  assert.match(
    output,
    /DataCore active categories:\n(?:.*\n)*? {2}dc-powerplants \| DC Power Plants \| files: powerplant\.datacore\.csv/,
  );
  assert.match(output, /SCMDB derived bridge categories:/);
  assert.match(output, /mission-commodities \| Commodities \| files: datacore:commodities\.datacore\.csv/);
  assert.doesNotMatch(output, /SCMDB derived bridge categories:\n(?:.*\n)*?mission-commodities/);
  assert.doesNotMatch(output, /SCMDB derived bridge categories:\n(?:.*\n)*?mission-mining-locations/);
  assert.match(
    output,
    /DataCore raw fact datasets:\n(?:.*\n)*? {2}datacore-vehicles \| Vehicles \| files: vehicles\.datacore\.csv \| first-party vehicle labels/,
  );
  assert.match(
    output,
    /datacore-location-labels \| Law and location labels \| files: location-labels\.datacore\.csv \| first-party StarMap labels/,
  );
  assert.match(output, /Mixed-source batch modes:\n {2}update-all \| DataCore \+ SCMDB/);
  assert.doesNotMatch(output, /update-all --provider spviewer/);
});

test('provider coverage matrix distinguishes primary, fallback, and unavailable coverage', async () => {
  const matrix = await buildProviderCoverageMatrix();

  const coolers = matrix.rows.find((row) => row.category === 'Coolers');
  assert.deepEqual(coolers, {
    category: 'Coolers',
    datacore: { status: 'primary', slug: 'dc-coolers' },
    scmdb: { status: 'unavailable' },
  });

  const descriptions = matrix.rows.find((entry) => entry.category === 'DataCore mission descriptions');
  assert.deepEqual(descriptions, {
    category: 'DataCore mission descriptions',
    datacore: {
      slug: 'mission-datacore-descriptions',
      status: 'primary',
    },
    scmdb: {
      status: 'unavailable',
    },
  });

  assert.equal(
    matrix.rows.some((row) => row.datacore.status === 'primary'),
    true,
  );
  assert.equal(
    matrix.rows.some((row) => row.datacore.status === 'primary'),
    true,
  );

  assert.equal(matrix.mixedSources.length, 1);
});

test('formatted provider coverage matrix includes provider statuses and mixed-source modes', async () => {
  const output = formatProviderCoverageMatrix(await buildProviderCoverageMatrix());

  assert.match(output, /Provider coverage matrix/);
  assert.match(output, /\| Coolers \| primary \(dc-coolers\) \| unavailable \|/);
  assert.match(
    output,
    /\| DataCore mission descriptions \| primary \(mission-datacore-descriptions\) \| unavailable \|/,
  );
  assert.match(
    output,
    /Legend: primary = preferred first-party source, derived bridge = temporary generated\/relationship source/,
  );
  assert.match(output, /\| update-all \| DataCore \+ SCMDB \|/);
  assert.doesNotMatch(output, /update-all --provider spviewer/);
});
