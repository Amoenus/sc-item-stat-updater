import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMiningLocationRowsFromSources, compareMiningLocationCoverage } from './mining-locations';

test('buildMiningLocationRowsFromSources prefers DataCore provider weights and quality overrides', () => {
  const rows = buildMiningLocationRowsFromSources(
    [
      providerRow({
        Location: 'hpp_stanton1',
        'Group Name': 'SpaceShip_Mineables',
        'Group Probability': '6',
        'Relative Probability': '3',
        'Composition Class': 'CommonShipMineablesAsteroid_Aluminum',
      }),
      providerRow({
        Location: 'hpp_stanton1',
        'Group Name': 'SpaceShip_Mineables',
        'Group Probability': '6',
        'Relative Probability': '1',
        'Composition Class': 'CommonShipMineablesAsteroid_Iron',
      }),
      providerRow({
        Location: 'hpp_stanton1',
        'Group Name': 'FPS_Mineables',
        'Group Probability': '25',
        'Relative Probability': '2',
        'Composition Class': 'FPS_Hadanite',
      }),
      providerRow({
        Location: 'hpp_stanton1',
        'Group Name': 'GroundVehicle_Mineables',
        'Group Probability': '10',
        'Relative Probability': '4',
        'Composition Class': 'GroundVehicle_Beradom',
      }),
    ],
    [
      compositionRow('CommonShipMineablesAsteroid_Aluminum', 'Aluminum (Ore)', '80'),
      compositionRow('CommonShipMineablesAsteroid_Iron', 'Iron (Ore)', '80'),
      compositionRow('FPS_Hadanite', 'Hadanite', '100'),
      compositionRow('GroundVehicle_Beradom', 'Beradom', '100'),
    ],
    [
      {
        'Location Name': 'Hurston',
        'Ship Mineables': 'Old SCMDB ship row',
        'Hand Mineables': '',
        'Ground Vehicle Mineables': '',
        'Quality Note': 'Rare ship rocks: quality floor 60.0%',
      },
      {
        'Location Name': 'SCMDB Only',
        'Ship Mineables': 'Legacy rock - 100%',
        'Hand Mineables': '',
        'Ground Vehicle Mineables': '',
        'Quality Note': '',
      },
    ],
    [
      {
        'Location Class': 'AsteroidCluster_MiningBase_Stanton1_Medium_01',
        'Name Key': 'AsteroidCluster_MiningBase_Stanton01_Medium_01',
        'Description Key': 'AsteroidCluster_MiningBase_Desc',
        'Parent Class': 'Stanton1',
        'Record Path': 'libs/foundry/records/starmap/pu/asteroidcluster_miningbase_stanton1_medium_01.xml',
        'Source Reason': 'class-or-path-mining',
      },
    ],
    [
      qualityDistributionRow({
        'Mineable Family': 'shipmineables',
        'Location Class': 'Stanton01',
        'Location Path': 'libs/foundry/records/starmap/pu/stanton01.xml',
        'Min Quality': '600',
        'Max Quality': '1000',
        Mean: '800',
        Stddev: '125',
      }),
    ],
  );

  const hurston = rows.find((row) => row['Location Name'] === 'Hurston');
  assert.ok(hurston);
  assert.equal(hurston.Source, 'DataCore+SCMDB');
  assert.equal(hurston['Ship Mineables'], 'Aluminum (Ore) - 75%\nIron (Ore) - 25%');
  assert.equal(hurston['Hand Mineables'], 'Hadanite - 100%');
  assert.equal(hurston['Ground Vehicle Mineables'], 'Beradom - 100%');
  assert.equal(hurston['Quality Note'], 'Ship quality 60%-100% (mean 80%, stddev 12.5%)');
  assert.equal(hurston['DataCore Location Name Keys'], 'AsteroidCluster_MiningBase_Stanton01_Medium_01');
  assert.equal(hurston['DataCore Location Description Keys'], 'AsteroidCluster_MiningBase_Desc');
  assert.equal(hurston['DataCore Location Label Source'], 'class-or-path-mining');
  assert.equal(hurston['DataCore Quality Source'], 'shipmineables');

  const fallback = rows.find((row) => row['Location Name'] === 'SCMDB Only');
  assert.ok(fallback);
  assert.equal(fallback.Source, 'SCMDB');
  assert.equal(fallback['Ship Mineables'], 'Legacy rock - 100%');
});

test('compareMiningLocationCoverage reports DataCore and SCMDB location overlap', () => {
  const coverage = compareMiningLocationCoverage(
    [
      {
        'Location Name': 'Hurston',
        'DataCore Location Name Keys': 'AsteroidCluster_MiningBase_Stanton01_Medium_01',
        'DataCore Location Label Source': 'class-or-path-mining',
        'DataCore Quality Source': 'shipmineables',
      },
      { 'Location Name': 'Pyro I' },
    ],
    [
      { 'Location Name': 'Hurston' },
      { 'Location Name': 'Daymar' },
    ],
  );

  assert.deepEqual(coverage, {
    datacoreLocations: 2,
    scmdbLocations: 2,
    datacoreLocationLabelRows: 1,
    datacoreLocationsWithLabelKeys: 1,
    datacoreLocationsWithQualityNotes: 1,
    common: 1,
    datacoreOnly: ['Pyro I'],
    scmdbOnly: ['Daymar'],
  });
});

function providerRow(overrides: Record<string, string>): Record<string, string> {
  return {
    'Provider Class': 'HPP_Stanton1',
    Location: '',
    'Group Name': '',
    'Group Probability': '',
    'Relative Probability': '',
    'Composition Class': '',
    ...overrides,
  };
}

function compositionRow(compositionClass: string, elementName: string, maxPercentage: string): Record<string, string> {
  return {
    'Composition Class': compositionClass,
    'Mineable Element Name': elementName,
    'Min Percentage': '0',
    'Max Percentage': maxPercentage,
    Probability: '1',
  };
}

function qualityDistributionRow(overrides: Record<string, string>): Record<string, string> {
  return {
    'Distribution Type': 'location-override',
    'Mineable Family': '',
    'Location Class': '',
    'Location Path': '',
    'Min Quality': '',
    'Max Quality': '',
    Mean: '',
    Stddev: '',
    ...overrides,
  };
}
