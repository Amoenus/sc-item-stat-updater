import assert from 'node:assert/strict';
import test from 'node:test';
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

test('pipeline command defaults to source refresh and deploy', async () => {
  const io = createFakeIO();
  const observed: unknown[] = [];

  const exitCode = await runPipelineCommand([], io, {
    runFullPipeline: async (options) => {
      observed.push(options);
      return { exitCode: 0, repoIniPath: 'repo/global.ini', extractedGamePath: 'game/global.ini' };
    },
  });

  assert.equal(exitCode, 0);
  assert.equal((observed[0] as { refreshSources: boolean }).refreshSources, true);
  assert.equal((observed[0] as { deployUpdatedIni: boolean }).deployUpdatedIni, true);
  assert.equal(io.stderrText(), '');
});

test('pipeline command renders phases and task completions', async () => {
  const io = createFakeIO();

  const exitCode = await runPipelineCommand([], io, {
    runFullPipeline: async (options) => {
      options.onPhaseStart?.({ id: 'extract-global-ini', label: 'Extract global.ini' });
      options.onStepComplete?.('global.ini extracted & synced to repo');
      options.onPhaseStart?.({ id: 'refresh-sources', label: 'Refresh source caches' });
      options.onSourceStart?.('scmdb');
      options.onStepComplete?.('SCMDB cache refreshed');
      options.onPhaseStart?.({ id: 'apply-updates', label: 'Apply localization updates' });
      options.onStepComplete?.('Stat updates applied');
      options.onPhaseStart?.({ id: 'deploy-global-ini', label: 'Deploy global.ini' });
      options.onStepComplete?.('global.ini deployed to game directory');
      return { exitCode: 0, repoIniPath: 'repo/global.ini', extractedGamePath: 'game/global.ini' };
    },
  });

  assert.equal(exitCode, 0);
  assert.match(io.stdoutText(), /\[1\/4\] Extract global\.ini/);
  assert.match(io.stdoutText(), /OK global\.ini extracted & synced to repo/);
  assert.match(io.stdoutText(), /\[2\/4\] Refresh source caches/);
  assert.match(io.stdoutText(), /- SCMDB cache - refreshing source outputs/);
  assert.match(io.stdoutText(), /OK SCMDB cache refreshed/);
  assert.match(io.stdoutText(), /\[4\/4\] Deploy global\.ini/);
  assert.match(io.stdoutText(), /Pipeline complete/);
});

test('pipeline command maps cached, repo-only, and rebuild-cache flags', async () => {
  const io = createFakeIO();
  const observed: unknown[] = [];

  const exitCode = await runPipelineCommand(['--cached', '--repo-only', '--rebuild-cache', '--ptu'], io, {
    runFullPipeline: async (options) => {
      observed.push(options);
      return { exitCode: 0, repoIniPath: 'repo/global.ini', extractedGamePath: 'game/global.ini' };
    },
  });

  assert.equal(exitCode, 0);
  assert.equal((observed[0] as { refreshSources: boolean }).refreshSources, false);
  assert.equal((observed[0] as { deployUpdatedIni: boolean }).deployUpdatedIni, false);
  assert.equal((observed[0] as { force: boolean }).force, true);
  assert.equal((observed[0] as { ptu: boolean }).ptu, true);
});

test('pipeline command treats npm rebuild-cache config as force fallback', async () => {
  const io = createFakeIO();
  const observed: unknown[] = [];
  const original = process.env.npm_config_rebuild_cache;
  process.env.npm_config_rebuild_cache = 'true';

  try {
    const exitCode = await runPipelineCommand([], io, {
      runFullPipeline: async (options) => {
        observed.push(options);
        return { exitCode: 0, repoIniPath: 'repo/global.ini', extractedGamePath: 'game/global.ini' };
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
