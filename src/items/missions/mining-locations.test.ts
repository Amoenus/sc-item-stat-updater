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
        'Harvestable Class': 'AsteroidRockPreset_Aluminum',
        'Harvestable Entity Class': 'AsteroidRock_Aluminum',
        'Harvestable Setup Class': 'ShipRockSetup',
        'Filled Factor': '0.75',
        'Clustering Class': 'Asteroid_Lrg_Med_Sml',
        'Global Params GUID': 'global-guid',
        'Audio Params GUID': 'audio-guid',
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
        'Location Name': 'Hathor Caves',
        'Ship Mineables': 'Legacy rock - 100%',
        'Hand Mineables': '',
        'Ground Vehicle Mineables': '',
        'Quality Note': '',
      },
      {
        'Location Name': 'Unknown SCMDB Only',
        'Ship Mineables': 'Should not leak into DataCore output',
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
    [
      {
        'Entity Class': 'AsteroidRock_Aluminum',
        'Density Class': 'EntityDensityClass_Mineable',
      },
    ],
    [
      {
        'Override Class': 'Stanton_HighTechMiningOutpost',
        'Density Class': 'EntityDensityClass_Mineable',
        'Lifetime Total Seconds': '72000',
      },
    ],
    [
      {
        'Clustering Class': 'Asteroid_Lrg_Med_Sml',
        'Probability Of Clustering': '10',
        'Relative Probability': '1',
        'Min Size': '2',
        'Max Size': '5',
        'Min Proximity': '3',
        'Max Proximity': '12',
      },
    ],
    [
      {
        'Harvestable Preset Class': 'AsteroidRockPreset_Aluminum',
        'Harvestable Entity Class': 'AsteroidRock_Aluminum',
        'Respawn In Slot Time': '1800',
        'Special Harvestable String': 'rare-rock',
      },
    ],
    [
      {
        'Setup Class': 'ShipRockSetup',
        'Respawn In Slot Time': '3600',
        'Despawn Time Seconds': '600',
        'Min Scale': '0.75',
        'Max Scale': '1.5',
      },
    ],
    [
      {
        'Config Class': 'AsteroidSubHarvestables',
        'Config Type': 'single',
        'Tagged Config Name': 'Ship rocks',
        'Initial Slots Probability': '0.8',
        'Config Respawn Time Multiplier': '1.5',
        'Harvestable Class': 'AsteroidRockPreset_Aluminum',
        'Harvestable Entity Class': 'AsteroidRock_Aluminum',
        'Harvestable Setup Class': 'ShipRockSetup',
        'Relative Probability': '0.25',
        'Deepest Relative Probability': '0.1',
        'Harvestable Respawn Time Multiplier': '2',
        'Geometry Tags': 'asteroid;large',
      },
    ],
    [
      miningParamRow({
        'Record GUID': 'global-guid',
        'Param Type': 'MiningGlobalParams',
        'Param Class': 'MiningGlobalParams_Ship',
        'Power Capacity Per Mass': '0.5',
        'Decay Per Mass': '0.2',
        'Optimal Window Size': '0.3',
        'CSCU Per Volume': '12',
        'Default Mass': '1000',
      }),
      miningParamRow({
        'Record GUID': 'audio-guid',
        'Param Type': 'MiningAudioParams',
        'Param Class': 'MiningAudioParams_Ship',
        'Mineable Power Increasing Fall Off': '0.7',
        'Mining Start Trigger': 'start_mining',
        'Mining Stop Trigger': 'stop_mining',
        'Extracted Trigger': 'extracted',
      }),
      miningParamRow({
        'Record GUID': 'density-guid',
        'Param Type': 'SEntityDensityClass',
        'Param Class': 'EntityDensityClass_Mineable',
        'Cluster Detection Radius': '1200',
        'Cluster Upper Object Count DGS': '20',
        'Cluster Upper Object Count Persistence': '8',
        'Cluster Persistence Timeout': '300',
        'Reset Lifetime On Move': '1',
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
  assert.equal(hurston['DataCore Mineable Entity Classes'], 'AsteroidRock_Aluminum');
  assert.equal(hurston['DataCore Density Classes'], 'EntityDensityClass_Mineable');
  assert.equal(hurston['DataCore Density Override Summary'], 'Stanton_HighTechMiningOutpost (lifetime 72000s)');
  assert.equal(hurston['DataCore Filled Factors'], '0.75');
  assert.equal(hurston['DataCore Clustering Summary'], 'Asteroid_Lrg_Med_Sml (prob 10, rel 1, size 2-5, prox 3-12)');
  assert.equal(
    hurston['DataCore Harvestable Preset Summary'],
    'AsteroidRockPreset_Aluminum (respawn 1800, special rare-rock)',
  );
  assert.equal(hurston['DataCore Setup Summary'], 'ShipRockSetup (respawn 3600, despawn 600s, scale 0.75-1.5)');
  assert.equal(
    hurston['DataCore Sub-Harvestable Summary'],
    'AsteroidSubHarvestables/Ship rocks (single, rel 0.25, deep 0.1, slots 0.8, config respawn x1.5, harvest respawn x2, geometry asteroid;large)',
  );
  assert.equal(
    hurston['DataCore Global Param Summary'],
    'MiningGlobalParams_Ship (power/mass 0.5, decay/mass 0.2, window 0.3, cSCU/vol 12, mass 1000)',
  );
  assert.equal(
    hurston['DataCore Audio Param Summary'],
    'MiningAudioParams_Ship (falloff 0.7, start start_mining, stop stop_mining, extracted extracted)',
  );
  assert.equal(
    hurston['DataCore Density Param Summary'],
    'EntityDensityClass_Mineable (cluster radius 1200, DGS max 20, persistent max 8, timeout 300, resetOnMove 1)',
  );

  const fallback = rows.find((row) => row['Location Name'] === 'Hathor Caves');
  assert.ok(fallback);
  assert.equal(fallback.Source, 'SCMDB legacy special-site fallback');
  assert.equal(fallback['Ship Mineables'], 'Legacy rock - 100%');
  assert.equal(rows.some((row) => row['Location Name'] === 'Unknown SCMDB Only'), false);
});

test('compareMiningLocationCoverage reports DataCore and SCMDB location overlap', () => {
  const coverage = compareMiningLocationCoverage(
    [
      {
        'Location Name': 'Hurston',
        'DataCore Location Name Keys': 'AsteroidCluster_MiningBase_Stanton01_Medium_01',
        'DataCore Location Label Source': 'class-or-path-mining',
        'DataCore Quality Source': 'shipmineables',
        'DataCore Mineable Entity Classes': 'AsteroidRock_Aluminum',
        'DataCore Density Override Summary': 'Stanton_HighTechMiningOutpost (lifetime 72000s)',
        'DataCore Clustering Summary': 'Asteroid_Lrg_Med_Sml (prob 10)',
        'DataCore Harvestable Preset Summary': 'AsteroidRockPreset_Aluminum (respawn 1800)',
        'DataCore Setup Summary': 'ShipRockSetup (respawn 3600)',
        'DataCore Sub-Harvestable Summary': 'AsteroidSubHarvestables/Ship rocks (single)',
        'DataCore Global Param Summary': 'MiningGlobalParams_Ship (power/mass 0.5)',
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
    datacoreLocationsWithEntityFacts: 1,
    datacoreLocationsWithDensityOverrideFacts: 1,
    datacoreLocationsWithClusteringFacts: 1,
    datacoreLocationsWithHarvestablePresetFacts: 1,
    datacoreLocationsWithSetupFacts: 1,
    datacoreLocationsWithSubHarvestableFacts: 1,
    datacoreLocationsWithParamFacts: 1,
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
    'Harvestable Class': '',
    'Harvestable Entity Class': '',
    'Harvestable Setup Class': '',
    'Filled Factor': '',
    'Clustering Class': '',
    'Global Params GUID': '',
    'Audio Params GUID': '',
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

function miningParamRow(overrides: Record<string, string>): Record<string, string> {
  return {
    'Record GUID': '',
    'Param Type': '',
    'Param Class': '',
    'Power Capacity Per Mass': '',
    'Decay Per Mass': '',
    'Optimal Window Size': '',
    'CSCU Per Volume': '',
    'Default Mass': '',
    'Mineable Power Increasing Fall Off': '',
    'Mining Start Trigger': '',
    'Mining Stop Trigger': '',
    'Extracted Trigger': '',
    'Cluster Detection Radius': '',
    'Cluster Upper Object Count DGS': '',
    'Cluster Upper Object Count Persistence': '',
    'Cluster Persistence Timeout': '',
    'Reset Lifetime On Move': '',
    ...overrides,
  };
}
