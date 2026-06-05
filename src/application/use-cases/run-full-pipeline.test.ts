import assert from 'node:assert/strict';
import test from 'node:test';
import { runFullPipeline } from './run-full-pipeline';

test('runFullPipeline runs update in process instead of shelling out to update-all', async () => {
  const completed: string[] = [];
  const updateOptions: unknown[] = [];
  const scmdbOptions: unknown[] = [];
  const spviewerOptions: unknown[] = [];
  const logs: string[] = [];

  const result = await runFullPipeline({
    rootDir: 'repo',
    scrape: true,
    dryRun: true,
    ptu: true,
    refresh: async ({ repoIniPath }) => ({ repoIniPath, extractedGamePath: 'game/global.ini' }),
    deploy: async ({ repoIniPath, targetIniPath }) => {
      assert.equal(repoIniPath, 'repo\\global.ini');
      assert.equal(targetIniPath, 'game/global.ini');
      return { repoIniPath, targetIniPath };
    },
    runScmdb: async (options) => {
      scmdbOptions.push(options);
      return {
        selected: { version: 'scmdb-live', file: 'merged-scmdb-live.json' },
        outDir: 'repo/csv/scmdb/scmdb-live',
        missionsOutDir: 'repo/csv/scmdb/scmdb-live/missions',
        files: [],
      };
    },
    runSpviewer: async (options) => {
      spviewerOptions.push(options);
      return {
        exitCode: 0,
        channel: 'ptu',
        version: '4.8.0-ptu',
        outDir: 'repo/csv/spviewer/4.8.0-ptu',
        types: ['Shield'],
        files: [],
        errors: [],
      };
    },
    runUpdate: async (options) => {
      updateOptions.push(options);
      return {
        exitCode: 0,
        results: [],
        errors: [],
        prepared: {} as never,
        sourceDiagnostics: {
          versions: [
            {
              provider: 'scmdb',
              label: 'SCMDB',
              channel: 'PTU',
              version: 'scmdb-ptu',
              path: 'repo/csv/scmdb/scmdb-ptu',
            },
          ],
          warnings: [],
        },
        iniPath: 'repo\\global.ini',
        totalDurationMs: 0,
      };
    },
    log: (message) => logs.push(message),
    onStepComplete: (summary) => {
      completed.push(summary);
    },
  });

  assert.deepEqual(result, {
    exitCode: 0,
    extractedGamePath: 'game/global.ini',
    repoIniPath: 'repo\\global.ini',
  });
  assert.deepEqual(scmdbOptions, [{ repoRoot: 'repo', ptu: true }]);
  assert.deepEqual(spviewerOptions, [{ repoRoot: 'repo', ptu: true }]);
  assert.deepEqual(updateOptions, [
    {
      repoRoot: 'repo',
      dryRun: true,
      ptu: true,
      provider: 'spviewer',
    },
  ]);
  assert.deepEqual(completed, [
    'global.ini extracted & synced to repo',
    'SCMDB scraped',
    'SPViewer scraped',
    'Stat updates applied',
    'global.ini deployed to game directory',
  ]);
  assert.ok(logs.some((message) => message.includes('SCMDB (PTU): scmdb-ptu')));
});

test('runFullPipeline returns the in-process update exit code and skips deployment on update errors', async () => {
  let deployed = false;
  const datacoreOptions: unknown[] = [];
  const logs: string[] = [];

  const result = await runFullPipeline({
    rootDir: 'repo',
    datacore: true,
    refresh: async ({ repoIniPath }) => ({ repoIniPath, extractedGamePath: 'game/global.ini' }),
    deploy: async ({ repoIniPath, targetIniPath }) => {
      deployed = true;
      return { repoIniPath, targetIniPath };
    },
    runScmdb: async () => ({
      selected: { version: 'scmdb-live', file: 'merged-scmdb-live.json' },
      outDir: 'repo/csv/scmdb/scmdb-live',
      missionsOutDir: 'repo/csv/scmdb/scmdb-live/missions',
      files: [],
    }),
    runDatacore: async (options) => {
      datacoreOptions.push(options);
      return {
        exitCode: 0,
        gameVersion: '4.8.0',
        channel: 'live',
        versionTag: '4.8.0-live',
        dcbPath: 'Game.dcb',
        outputBase: 'repo/csv/datacore/4.8.0-live',
        xmlCacheDir: 'repo/csv/datacore/.xmlcache/4.8.0-live',
        allTypes: [],
        selectedTypes: [],
        recordGraph: {
          recordCount: 0,
          outputPath: 'repo/csv/datacore/4.8.0-live/record-graph.json',
        },
        commodityResult: {
          rows: 0,
          csvFile: 'commodities.datacore.csv',
        },
        vehicleResult: {
          rows: 0,
          csvFile: 'vehicles.datacore.csv',
        },
        factionResult: {
          rows: 0,
          csvFile: 'factions.datacore.csv',
        },
        manufacturerResult: {
          rows: 0,
          csvFile: 'manufacturers.datacore.csv',
        },
        locationLabelResult: {
          rows: 0,
          csvFile: 'location-labels.datacore.csv',
        },
        miningElementResult: {
          rows: 0,
          csvFile: 'mining-elements.datacore.csv',
        },
        miningCompositionResult: {
          rows: 0,
          csvFile: 'mining-compositions.datacore.csv',
        },
        mineableEntityResult: {
          rows: 0,
          csvFile: 'mineable-entities.datacore.csv',
        },
        miningDensityOverrideResult: {
          rows: 0,
          csvFile: 'mining-density-overrides.datacore.csv',
        },
        miningClusteringResult: {
          rows: 0,
          csvFile: 'mining-clustering.datacore.csv',
        },
        miningHarvestablePresetResult: {
          rows: 0,
          csvFile: 'mining-harvestable-presets.datacore.csv',
        },
        miningHarvestableSetupResult: {
          rows: 0,
          csvFile: 'mining-harvestable-setups.datacore.csv',
        },
        miningSubHarvestableConfigResult: {
          rows: 0,
          csvFile: 'mining-sub-harvestable-configs.datacore.csv',
        },
        miningQualityDistributionResult: {
          rows: 0,
          csvFile: 'mining-quality-distributions.datacore.csv',
        },
        miningLocationLabelResult: {
          rows: 0,
          csvFile: 'mining-location-labels.datacore.csv',
        },
        miningParamResult: {
          rows: 0,
          csvFile: 'mining-params.datacore.csv',
        },
        miningProviderPresetResult: {
          rows: 0,
          csvFile: 'mining-provider-presets.datacore.csv',
        },
        rawFactResults: [],
        results: [],
        errors: [],
      };
    },
    runUpdate: async (options) => ({
      exitCode: 1,
      results: [],
      errors: [{ label: 'DataCore', message: 'failed' }],
      prepared: {} as never,
      sourceDiagnostics: {
        versions: [],
        warnings: [],
      },
      scmdbDependencyAudit: {
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
      },
      iniPath: `${options.repoRoot}\\global.ini`,
      totalDurationMs: 0,
    }),
    log: (message) => logs.push(message),
  });

  assert.equal(result.exitCode, 1);
  assert.equal(deployed, false);
  assert.deepEqual(datacoreOptions, [{ repoRoot: 'repo', ptu: undefined }]);
  assert.ok(logs.some((message) => message.includes('SCMDB dependency audit')));
  assert.ok(logs.some((message) => message.includes('mission-scmdb-descriptions')));
});
