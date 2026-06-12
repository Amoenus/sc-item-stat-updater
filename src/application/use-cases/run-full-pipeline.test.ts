import assert from 'node:assert/strict';
import test from 'node:test';
import type { runBatchUpdate } from './run-batch-update';
import { runFullPipeline } from './run-full-pipeline';

type BatchUpdateOptions = Parameters<typeof runBatchUpdate>[0];

function successfulUpdateResult(options: BatchUpdateOptions): Awaited<ReturnType<typeof runBatchUpdate>> {
  return {
    exitCode: 0,
    results: [],
    errors: [],
    prepared: {} as Awaited<ReturnType<typeof runBatchUpdate>>['prepared'],
    sourceDiagnostics: {
      versions: [
        {
          provider: 'scmdb',
          label: 'SCMDB',
          channel: options.ptu ? 'PTU' : 'LIVE',
          version: options.ptu ? 'scmdb-ptu' : 'scmdb-live',
          path: `repo/csv/scmdb/${options.ptu ? 'scmdb-ptu' : 'scmdb-live'}`,
        },
      ],
      warnings: [],
    },
    iniPath: `${options.repoRoot}\\global.ini`,
    totalDurationMs: 0,
  };
}

test('runFullPipeline refreshes baseline, sources, update, and deploys by default', async () => {
  const completed: string[] = [];
  const updateOptions: BatchUpdateOptions[] = [];
  const cacheOptions: unknown[] = [];
  const logs: string[] = [];

  const result = await runFullPipeline({
    rootDir: 'repo',
    dryRun: true,
    ptu: true,
    refresh: async ({ repoIniPath }) => ({ repoIniPath, extractedGamePath: 'game/global.ini' }),
    deploy: async ({ repoIniPath, targetIniPath }) => {
      assert.equal(repoIniPath, 'repo\\global.ini');
      assert.equal(targetIniPath, 'game/global.ini');
      return { repoIniPath, targetIniPath };
    },
    refreshSourcesUseCase: async (options) => {
      cacheOptions.push(options);
      return { exitCode: 0, refreshed: ['scmdb', 'datacore'] };
    },
    runUpdate: async (options) => {
      updateOptions.push(options);
      return successfulUpdateResult(options);
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
  assert.equal(cacheOptions.length, 1);
  assert.equal(updateOptions[0].repoRoot, 'repo');
  assert.equal(updateOptions[0].dryRun, true);
  assert.equal(updateOptions[0].ptu, true);
  assert.equal(updateOptions[0].provider, 'datacore');
  assert.equal(typeof updateOptions[0].onCategoryError, 'function');
  assert.deepEqual(completed, [
    'global.ini extracted & synced to repo',
    'SCMDB cache refreshed',
    'DATACORE cache refreshed',
    'Stat updates applied',
    'global.ini deployed to game directory',
  ]);
  assert.ok(logs.some((message) => message.includes('SCMDB (PTU): scmdb-ptu')));
});

test('runFullPipeline can use cached source outputs and skip deployment', async () => {
  let deployed = false;
  let refreshedSources = false;
  const updateOptions: BatchUpdateOptions[] = [];
  const logs: string[] = [];

  const result = await runFullPipeline({
    rootDir: 'repo',
    refreshSources: false,
    deployUpdatedIni: false,
    refresh: async ({ repoIniPath }) => ({ repoIniPath, extractedGamePath: 'game/global.ini' }),
    deploy: async ({ repoIniPath, targetIniPath }) => {
      deployed = true;
      return { repoIniPath, targetIniPath };
    },
    refreshSourcesUseCase: async () => {
      refreshedSources = true;
      return { exitCode: 0, refreshed: ['scmdb', 'datacore'] };
    },
    runUpdate: async (options) => {
      updateOptions.push(options);
      return successfulUpdateResult(options);
    },
    log: (message) => logs.push(message),
  });

  assert.equal(result.exitCode, 0);
  assert.equal(refreshedSources, false);
  assert.equal(deployed, false);
  assert.equal(updateOptions[0].repoRoot, 'repo');
  assert.ok(logs.some((message) => message.includes('Using cached source outputs')));
  assert.ok(logs.some((message) => message.includes('Skipping deploy')));
});

test('runFullPipeline returns the update exit code and skips deployment on update errors', async () => {
  let deployed = false;
  const logs: string[] = [];

  const result = await runFullPipeline({
    rootDir: 'repo',
    refreshSources: false,
    refresh: async ({ repoIniPath }) => ({ repoIniPath, extractedGamePath: 'game/global.ini' }),
    deploy: async ({ repoIniPath, targetIniPath }) => {
      deployed = true;
      return { repoIniPath, targetIniPath };
    },
    runUpdate: async (options) => ({
      ...successfulUpdateResult(options),
      exitCode: 1,
      errors: [{ label: 'DataCore', message: 'failed' }],
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
    }),
    log: (message) => logs.push(message),
  });

  assert.equal(result.exitCode, 1);
  assert.equal(deployed, false);
  assert.ok(logs.some((message) => message.includes('SCMDB dependency audit')));
  assert.ok(logs.some((message) => message.includes('mission-scmdb-descriptions')));
});
