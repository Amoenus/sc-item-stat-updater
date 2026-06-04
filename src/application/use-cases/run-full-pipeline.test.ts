import assert from 'node:assert/strict';
import test from 'node:test';
import { runFullPipeline } from './run-full-pipeline';

test('runFullPipeline runs update in process instead of shelling out to update-all', async () => {
  const scriptCalls: string[][] = [];
  const completed: string[] = [];
  const updateOptions: unknown[] = [];
  const scmdbOptions: unknown[] = [];

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
    runScript: (scriptArgs) => {
      scriptCalls.push(scriptArgs);
      return 0;
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
    runUpdate: async (options) => {
      updateOptions.push(options);
      return {
        exitCode: 0,
        results: [],
        errors: [],
        prepared: {} as never,
        iniPath: 'repo\\global.ini',
        totalDurationMs: 0,
      };
    },
    onStepComplete: (summary) => {
      completed.push(summary);
    },
  });

  assert.deepEqual(result, {
    exitCode: 0,
    extractedGamePath: 'game/global.ini',
    repoIniPath: 'repo\\global.ini',
  });
  assert.deepEqual(scriptCalls, [['bin/scrape-spviewer.ts', '--all']]);
  assert.deepEqual(scmdbOptions, [{ repoRoot: 'repo', ptu: true }]);
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
});

test('runFullPipeline returns the in-process update exit code and skips deployment on update errors', async () => {
  let deployed = false;

  const result = await runFullPipeline({
    rootDir: 'repo',
    datacore: true,
    refresh: async ({ repoIniPath }) => ({ repoIniPath, extractedGamePath: 'game/global.ini' }),
    deploy: async ({ repoIniPath, targetIniPath }) => {
      deployed = true;
      return { repoIniPath, targetIniPath };
    },
    runScript: () => 0,
    runScmdb: async () => ({
      selected: { version: 'scmdb-live', file: 'merged-scmdb-live.json' },
      outDir: 'repo/csv/scmdb/scmdb-live',
      missionsOutDir: 'repo/csv/scmdb/scmdb-live/missions',
      files: [],
    }),
    runUpdate: async (options) => ({
      exitCode: 1,
      results: [],
      errors: [{ label: 'DataCore', message: 'failed' }],
      prepared: {} as never,
      iniPath: `${options.repoRoot}\\global.ini`,
      totalDurationMs: 0,
    }),
  });

  assert.equal(result.exitCode, 1);
  assert.equal(deployed, false);
});
