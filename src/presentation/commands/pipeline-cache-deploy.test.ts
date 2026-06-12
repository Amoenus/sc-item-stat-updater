import assert from 'node:assert/strict';
import test from 'node:test';
import type { runBatchUpdate } from '../../application/use-cases/run-batch-update';
import type { CommandIO } from '../cli';
import { runCacheCommand } from './cache';
import { runDeployCommand } from './deploy';
import { runPipelineCommand } from './pipeline';

function createFakeIO(): CommandIO & { stdoutText: () => string; stderrText: () => string } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    cwd: process.cwd(),
    stdout: {
      isTTY: false,
      write(chunk: string | Uint8Array) {
        stdout.push(String(chunk));
        return true;
      },
    },
    stderr: {
      isTTY: false,
      write(chunk: string | Uint8Array) {
        stderr.push(String(chunk));
        return true;
      },
    },
    stdoutText: () => stdout.join(''),
    stderrText: () => stderr.join(''),
  };
}

function successfulUpdateResult(): Awaited<ReturnType<typeof runBatchUpdate>> {
  return {
    exitCode: 0,
    results: [],
    errors: [],
    prepared: {} as Awaited<ReturnType<typeof runBatchUpdate>>['prepared'],
    sourceDiagnostics: { versions: [], warnings: [] },
    iniPath: 'repo/global.ini',
    totalDurationMs: 0,
  };
}

test('pipeline command defaults to source refresh and deploy', async () => {
  const io = createFakeIO();
  const observed: unknown[] = [];

  const exitCode = await runPipelineCommand([], io, {
    refreshGlobalIni: async ({ repoIniPath }) => ({ repoIniPath, extractedGamePath: 'game/global.ini' }),
    refreshSourceCache: async (options) => {
      observed.push(options);
      return { exitCode: 0, refreshed: [options.target === 'scmdb' ? 'scmdb' : 'datacore'] };
    },
    runBatchUpdate: async () => successfulUpdateResult(),
    deployGlobalIni: async (options) => options,
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(observed.map((entry) => (entry as { target: string }).target).sort(), ['datacore', 'scmdb']);
  assert.equal(io.stderrText(), '');
});

test('pipeline command renders phases and task completions', async () => {
  const io = createFakeIO();

  const exitCode = await runPipelineCommand([], io, {
    refreshGlobalIni: async ({ repoIniPath, log }) => {
      log?.('global.ini extracted');
      return { repoIniPath, extractedGamePath: 'game/global.ini' };
    },
    refreshSourceCache: async (options) => {
      options.log?.(`${options.target?.toUpperCase()} cache refreshed`);
      return { exitCode: 0, refreshed: [options.target === 'scmdb' ? 'scmdb' : 'datacore'] };
    },
    runBatchUpdate: async () => successfulUpdateResult(),
    deployGlobalIni: async (options) => options,
  });

  assert.equal(exitCode, 0);
  assert.match(io.stdoutText(), /Extract fresh global\.ini/);
  assert.match(io.stdoutText(), /Refresh source caches/);
  assert.match(io.stdoutText(), /SCMDB cache/);
  assert.match(io.stdoutText(), /DATACORE cache/);
  assert.match(io.stdoutText(), /Apply localization updates/);
  assert.match(io.stdoutText(), /Deploy global\.ini to game/);
  assert.match(io.stdoutText(), /Pipeline complete/);
});

test('pipeline command maps cached, repo-only, and rebuild-cache flags', async () => {
  const io = createFakeIO();
  const updateOptions: unknown[] = [];
  const deployed: unknown[] = [];

  const exitCode = await runPipelineCommand(['--cached', '--repo-only', '--rebuild-cache', '--ptu'], io, {
    refreshGlobalIni: async ({ repoIniPath }) => ({ repoIniPath, extractedGamePath: 'game/global.ini' }),
    refreshSourceCache: async () => {
      throw new Error('source refresh should be skipped');
    },
    runBatchUpdate: async (options) => {
      updateOptions.push(options);
      return successfulUpdateResult();
    },
    deployGlobalIni: async (options) => {
      deployed.push(options);
      return options;
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(updateOptions.length, 1);
  assert.equal(deployed.length, 0);
  assert.equal((updateOptions[0] as { ptu: boolean }).ptu, true);
});

test('pipeline command treats npm rebuild-cache config as force fallback', async () => {
  const io = createFakeIO();
  const observed: unknown[] = [];
  const original = process.env.npm_config_rebuild_cache;
  process.env.npm_config_rebuild_cache = 'true';

  try {
    const exitCode = await runPipelineCommand([], io, {
      refreshGlobalIni: async ({ repoIniPath }) => ({ repoIniPath, extractedGamePath: 'game/global.ini' }),
      refreshSourceCache: async (options) => {
        observed.push(options);
        return { exitCode: 0, refreshed: [options.target === 'scmdb' ? 'scmdb' : 'datacore'] };
      },
      runBatchUpdate: async () => successfulUpdateResult(),
      deployGlobalIni: async (options) => options,
    });

    assert.equal(exitCode, 0);
    assert.equal((observed[0] as { force: boolean }).force, true);
    assert.equal((observed[1] as { force: boolean }).force, true);
  } finally {
    if (original === undefined) {
      delete process.env.npm_config_rebuild_cache;
    } else {
      process.env.npm_config_rebuild_cache = original;
    }
  }
});

test('pipeline command rejects npm force flag name', async () => {
  const io = createFakeIO();
  await assert.rejects(() => runPipelineCommand(['--force'], io), /Unknown option '--force'/);
});

test('cache command refreshes source outputs without global.ini workflow hooks', async () => {
  const io = createFakeIO();
  const observed: unknown[] = [];

  const exitCode = await runCacheCommand(['--source', 'datacore', '--rebuild-cache'], io, {
    refreshSourceCache: async (options) => {
      observed.push(options);
      return { exitCode: 0, refreshed: ['datacore'] };
    },
  });

  assert.equal(exitCode, 0);
  assert.equal((observed[0] as { target: string }).target, 'datacore');
  assert.equal((observed[0] as { force: boolean }).force, true);
  assert.match(io.stdoutText(), /Cache refresh complete: datacore/);
  assert.equal(io.stderrText(), '');
});

test('cache command treats npm rebuild-cache config as force fallback', async () => {
  const io = createFakeIO();
  const observed: unknown[] = [];
  const original = process.env.npm_config_rebuild_cache;
  process.env.npm_config_rebuild_cache = 'true';

  try {
    const exitCode = await runCacheCommand(['--source', 'datacore'], io, {
      refreshSourceCache: async (options) => {
        observed.push(options);
        return { exitCode: 0, refreshed: ['datacore'] };
      },
    });

    assert.equal(exitCode, 0);
    assert.equal((observed[0] as { force: boolean }).force, true);
  } finally {
    if (original === undefined) {
      delete process.env.npm_config_rebuild_cache;
    } else {
      process.env.npm_config_rebuild_cache = original;
    }
  }
});

test('cache command rejects npm force flag name', async () => {
  const io = createFakeIO();
  await assert.rejects(() => runCacheCommand(['--force'], io), /Unknown option '--force'/);
});

test('deploy command resolves the game target and copies repo global.ini', async () => {
  const io = createFakeIO();
  const observed: unknown[] = [];

  const exitCode = await runDeployCommand(['--ini-path', 'custom-global.ini'], io, {
    resolveLiveDir: () => 'C:/Games/StarCitizen/LIVE',
    deployGlobalIni: async (options) => {
      observed.push(options);
      return options;
    },
  });

  assert.equal(exitCode, 0);
  assert.match((observed[0] as { repoIniPath: string }).repoIniPath, /custom-global\.ini$/);
  assert.equal(
    (observed[0] as { targetIniPath: string }).targetIniPath,
    'C:\\Games\\StarCitizen\\LIVE\\Data\\Localization\\english\\global.ini',
  );
  assert.match(io.stdoutText(), /Deployed/);
  assert.equal(io.stderrText(), '');
});
