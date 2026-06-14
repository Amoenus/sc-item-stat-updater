import assert from 'node:assert/strict';
import test from 'node:test';
import miningLocationsConfig, {
  buildMiningLocationRowsFromSources,
  compareMiningLocationCoverage,
} from './mining-locations';

test('buildMiningLocationRowsFromSources prefers DataCore provider weights and quality overrides', () => {
  const rows = buildMiningLocationRowsFromSources(
    [
      providerRow({
        Location: 'hpp_stanton1',
        'Group Name': 'SpaceShip_Mineables',
        'Group Probability': '6',
        'Relative Probability': '3',
        'Composition GUID': 'composition-aluminum-guid',
        'Composition Class': 'CommonShipMineablesAsteroid_StaleClass',
        'Harvestable GUID': 'harvestable-preset-guid',
        'Harvestable Class': 'AsteroidRockPreset_StaleAluminum',
        'Harvestable Entity GUID': 'asteroid-rock-guid',
        'Harvestable Entity Class': 'AsteroidRock_StaleClass',
        'Harvestable Setup GUID': 'setup-guid',
        'Harvestable Setup Class': 'ShipRockSetup_Stale',
        'Filled Factor': '0.75',
        'Clustering GUID': 'clustering-guid',
        'Clustering Class': 'Asteroid_StaleCluster',
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
      providerRow({
        Location: 'hpp_stanton2b',
        'Group Name': 'SpaceShip_Mineables',
        'Group Probability': '1',
        'Relative Probability': '1',
        'Composition Class': 'CommonShipMineablesAsteroid_Iron',
        'Harvestable GUID': 'missing-harvestable-guid',
        'Harvestable Class': 'AsteroidRockPreset_Aluminum',
        'Harvestable Entity GUID': 'missing-entity-guid',
        'Harvestable Entity Class': 'AsteroidRock_Aluminum',
        'Harvestable Setup GUID': 'missing-setup-guid',
        'Harvestable Setup Class': 'ShipRockSetup',
      }),
    ],
    [
      compositionRow('CommonShipMineablesAsteroid_Aluminum', 'Aluminum (Ore)', '80', {
        'Record GUID': 'composition-aluminum-guid',
      }),
      compositionRow('CommonShipMineablesAsteroid_Iron', 'Iron (Ore)', '80'),
      compositionRow('FPS_Hadanite', 'Hadanite', '100'),
      compositionRow('GroundVehicle_Beradom', 'Beradom', '100'),
      compositionRow('FPS_Composition_AphoriteDeposit', 'Aphorite', '100', {
        'Record GUID': 'composition-aphorite-guid',
      }),
      compositionRow('FPS_Composition_SadaryxDeposit', 'Sadaryx', '100'),
      compositionRow('FPS_Composition_JacliumDeposit', 'Jaclium', '100'),
      compositionRow('LegendaryShipMineablesAsteroid_Savrilium_RCD', 'Savrilium (Ore)', '100'),
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
      {
        'Location Class': 'AsteroidCluster_MiningBase_Stanton1_Medium_02',
        'Name Key': 'LOC_PLACEHOLDER',
        'Description Key': 'LOC_UNINITIALIZED',
        'Parent Class': 'Stanton1',
        'Record Path': 'libs/foundry/records/starmap/pu/asteroidcluster_miningbase_stanton1_medium_02.xml',
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
        'Record GUID': 'asteroid-rock-guid',
        'Entity Class': 'AsteroidRock_Aluminum',
        'Density Class GUID': 'density-guid',
        'Density Class': 'EntityDensityClass_Mineable',
      },
      {
        'Record GUID': 'aphorite-entity-guid',
        'Entity Class': 'MineableRock_FPS_Aphorite',
        'Composition GUID': 'composition-aphorite-guid',
        'Composition Class': 'FPS_Composition_StaleAphorite',
      },
      {
        'Entity Class': 'MineableRock_FPS_Sadaryx',
        'Composition Class': 'FPS_Composition_SadaryxDeposit',
      },
      {
        'Entity Class': 'MineableRock_FPS_Jaclium',
        'Composition Class': 'FPS_Composition_JacliumDeposit',
      },
      {
        'Entity Class': 'MineableRock_AsteroidLegendary_Savrilium_RCD_large',
        'Composition Class': 'LegendaryShipMineablesAsteroid_Savrilium_RCD',
      },
    ],
    [
      {
        'Override Class': 'Stanton_HighTechMiningOutpost',
        'Density Class GUID': 'density-guid',
        'Density Class': 'EntityDensityClass_Mineable',
        'Lifetime Total Seconds': '72000',
      },
    ],
    [
      {
        'Record GUID': 'clustering-guid',
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
        'Record GUID': 'harvestable-preset-guid',
        'Harvestable Preset Class': 'AsteroidRockPreset_Aluminum',
        'Harvestable Entity GUID': 'asteroid-rock-guid',
        'Harvestable Entity Class': 'AsteroidRock_Aluminum',
        'Respawn In Slot Time': '1800',
        'Special Harvestable String': 'rare-rock',
      },
    ],
    [
      {
        'Record GUID': 'setup-guid',
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
        'Harvestable GUID': 'harvestable-preset-guid',
        'Harvestable Class': 'AsteroidRockPreset_Aluminum',
        'Harvestable Entity GUID': 'asteroid-rock-guid',
        'Harvestable Entity Class': 'AsteroidRock_Aluminum',
        'Harvestable Setup GUID': 'setup-guid',
        'Harvestable Setup Class': 'ShipRockSetup',
        'Relative Probability': '0.25',
        'Deepest Relative Probability': '0.1',
        'Harvestable Respawn Time Multiplier': '2',
        'Geometry Tags': 'asteroid;large',
      },
      subHarvestableRow({
        'Config Class': 'V3SlotPreset_RockCracker',
        'Tagged Config Name': 'Aphorite minable',
        'Harvestable Class': 'MineableRock_FPS_Aphorite',
        'Harvestable Entity GUID': 'aphorite-entity-guid',
        'Harvestable Entity Class': 'MineableRock_FPS_StaleAphorite',
        'Relative Probability': '1',
      }),
      subHarvestableRow({
        'Config Class': 'V3SlotPreset_RockCracker',
        'Tagged Config Name': 'Sadaryx minable',
        'Harvestable Class': 'MineableRock_FPS_Sadaryx',
        'Harvestable Entity Class': 'MineableRock_FPS_Sadaryx',
        'Relative Probability': '1',
      }),
      subHarvestableRow({
        'Config Class': 'V3SlotPreset_Harvestable_RockCracker_Asteroid',
        'Tagged Config Name': 'Central',
        'Harvestable Class': 'MineableRock_AsteroidLegendary_Savrilium_RCD_large',
        'Harvestable Entity Class': 'MineableRock_AsteroidLegendary_Savrilium_RCD_large',
        'Relative Probability': '1',
      }),
      subHarvestableRow({
        'Config Class': 'Loot_Caves_Unoccupied_Sand_Stanton_Orbageddon',
        'Tagged Config Name': 'FPS mineables',
        'Harvestable Class': 'FPSMining_Aphorite',
        'Harvestable Entity Class': 'MineableRock_FPS_Aphorite',
        'Relative Probability': '3',
      }),
      subHarvestableRow({
        'Config Class': 'Loot_Caves_Unoccupied_Sand_Stanton_Orbageddon',
        'Tagged Config Name': 'FPS mineables',
        'Harvestable Class': 'FPSMining_Jaclium',
        'Harvestable Entity Class': 'MineableRock_FPS_Jaclium',
        'Relative Probability': '2',
      }),
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
        'Param Class': 'EntityDensityClass_GraphResolved',
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
  assert.equal(hurston.Source, 'DataCore');
  assert.equal(hurston['Ship Mineables'], 'Aluminum (Ore) - 75%\nIron (Ore) - 25%');
  assert.equal(hurston['Hand Mineables'], 'Hadanite - 100%');
  assert.equal(hurston['Ground Vehicle Mineables'], 'Beradom - 100%');
  assert.equal(hurston['Quality Note'], 'Ship quality 60%-100% (mean 80%, stddev 12.5%)');
  assert.equal(hurston['DataCore Location Slugs'], 'hpp_stanton1');
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
    'EntityDensityClass_GraphResolved (cluster radius 1200, DGS max 20, persistent max 8, timeout 300, resetOnMove 1)',
  );

  const breakerInterior = rows.find((row) => row['Location Name'] === 'Breaker Stations Interior');
  assert.ok(breakerInterior);
  assert.equal(breakerInterior.Source, 'DataCore');
  assert.equal(breakerInterior['Hand Mineables'], 'Aphorite - 75%\nSadaryx - 25%');

  const breakerLargeGeode = rows.find((row) => row['Location Name'] === 'Breaker Stations Large Geode');
  assert.ok(breakerLargeGeode);
  assert.equal(breakerLargeGeode.Source, 'DataCore');
  assert.equal(breakerLargeGeode['Ship Mineables'], 'Savrilium (Ore) - 100%');

  const hathor = rows.find((row) => row['Location Name'] === 'Hathor Caves');
  assert.ok(hathor);
  assert.equal(hathor.Source, 'DataCore');
  assert.equal(hathor['Hand Mineables'], 'Aphorite - 60%\nJaclium (Ore) - 40%');
  assert.equal(hathor['Ship Mineables'], '');

  const daymar = rows.find((row) => row['Location Name'] === 'Daymar');
  assert.ok(daymar);
  assert.equal(
    daymar['DataCore Harvestable Preset Summary'],
    'AsteroidRockPreset_Aluminum (respawn 1800, special rare-rock)',
  );
  assert.equal(daymar['DataCore Setup Summary'], 'ShipRockSetup (respawn 3600, despawn 600s, scale 0.75-1.5)');
  assert.equal(
    daymar['DataCore Sub-Harvestable Summary'],
    'AsteroidSubHarvestables/Ship rocks (single, rel 0.25, deep 0.1, slots 0.8, config respawn x1.5, harvest respawn x2, geometry asteroid;large)',
  );
});

test('mining location target keys prefer DataCore description keys before slug fallback', () => {
  assert.deepEqual(
    miningLocationsConfig.getTargetKeys?.({
      'Location Name': 'Hurston',
      'DataCore Location Slugs': 'hpp_stanton1',
      'DataCore Location Description Keys': 'AsteroidCluster_MiningBase_Desc',
    }),
    ['AsteroidCluster_MiningBase_Desc', 'AsteroidCluster_MiningBase_Desc,P'],
  );

  assert.deepEqual(
    miningLocationsConfig.getTargetKeys?.({
      'Location Name': 'Hurston',
      'DataCore Location Slugs': 'hpp_stanton1',
    }),
    ['Stanton1_Desc', 'Stanton1_Desc,P'],
  );

  assert.deepEqual(
    miningLocationsConfig.getTargetKeys?.({
      'Location Name': 'Pyro V-a (Ignis)',
      'DataCore Location Slugs': 'hpp_pyro5a',
    }),
    ['Pyro5a_Ignis_desc', 'Pyro5a_Ignis_desc,P', 'Pyro5a_desc', 'Pyro5a_desc,P'],
  );

  assert.deepEqual(
    miningLocationsConfig.getTargetKeys?.({
      'Location Name': 'Pyro II (Monox)',
      'DataCore Location Slugs': 'hpp_pyro2',
    }),
    ['Pyro2_Monox_desc', 'Pyro2_Monox_desc,P', 'Pyro2_desc', 'Pyro2_desc,P'],
  );
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
    [{ 'Location Name': 'Hurston' }, { 'Location Name': 'Daymar' }],
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
    'Composition GUID': '',
    'Composition Class': '',
    'Harvestable GUID': '',
    'Harvestable Entity GUID': '',
    'Harvestable Class': '',
    'Harvestable Entity Class': '',
    'Harvestable Setup GUID': '',
    'Harvestable Setup Class': '',
    'Filled Factor': '',
    'Clustering GUID': '',
    'Clustering Class': '',
    'Global Params GUID': '',
    'Audio Params GUID': '',
    ...overrides,
  };
}

function compositionRow(
  compositionClass: string,
  elementName: string,
  maxPercentage: string,
  overrides: Record<string, string> = {},
): Record<string, string> {
  return {
    'Composition Class': compositionClass,
    'Mineable Element Name': elementName,
    'Min Percentage': '0',
    'Max Percentage': maxPercentage,
    Probability: '1',
    'Record GUID': '',
    ...overrides,
  };
}

function subHarvestableRow(overrides: Record<string, string>): Record<string, string> {
  return {
    'Config Class': '',
    'Config Type': 'multi-manual',
    'Tagged Config Name': '',
    'Initial Slots Probability': '1',
    'Harvestable Class': '',
    'Harvestable Entity GUID': '',
    'Harvestable Entity Class': '',
    'Relative Probability': '',
    'Deepest Relative Probability': '',
    'Geometry Tags': '',
    ...overrides,
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
