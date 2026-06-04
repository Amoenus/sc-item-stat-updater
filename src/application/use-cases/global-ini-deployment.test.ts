import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { deployGlobalIni } from './deploy-global-ini';
import { refreshGlobalIni } from './refresh-global-ini';

test('refreshGlobalIni extracts a fresh game global.ini and copies it into the repo', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'refresh-global-ini-'));
  const extractedGamePath = path.join(tmpDir, 'game-global.ini');
  const repoIniPath = path.join(tmpDir, 'repo-global.ini');
  await fs.writeFile(extractedGamePath, 'fresh');

  const observedLogs: string[] = [];
  const result = await refreshGlobalIni({
    repoIniPath,
    p4kFile: 'Data.p4k',
    log: (message) => observedLogs.push(message),
    extract: async (p4kFile, log) => {
      assert.equal(p4kFile, 'Data.p4k');
      log('extracting');
      return extractedGamePath;
    },
  });

  assert.deepEqual(result, { extractedGamePath, repoIniPath });
  assert.deepEqual(observedLogs, ['extracting']);
  assert.equal(await fs.readFile(repoIniPath, 'utf8'), 'fresh');
});

test('refreshGlobalIni distinguishes missing install and repo-copy failures', async () => {
  await assert.rejects(
    () =>
      refreshGlobalIni({
        repoIniPath: 'global.ini',
        extract: async () => {
          throw new Error('Data.p4k not found at: C:/Games/StarCitizen/LIVE/Data.p4k');
        },
      }),
    /Missing game install or Data\.p4k:/,
  );

  await assert.rejects(
    () =>
      refreshGlobalIni({
        repoIniPath: 'global.ini',
        extract: async () => 'game-global.ini',
        copyFile: async () => {
          throw new Error('permission denied');
        },
      }),
    /Failed to refresh repo global\.ini: permission denied/,
  );
});

test('deployGlobalIni copies the repo global.ini back to the extracted game path', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploy-global-ini-'));
  const repoIniPath = path.join(tmpDir, 'repo-global.ini');
  const targetIniPath = path.join(tmpDir, 'game-global.ini');
  await fs.writeFile(repoIniPath, 'enriched');

  const result = await deployGlobalIni({ repoIniPath, targetIniPath });

  assert.deepEqual(result, { repoIniPath, targetIniPath });
  assert.equal(await fs.readFile(targetIniPath, 'utf8'), 'enriched');
});

test('deployGlobalIni distinguishes missing repo file and deployment failures', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploy-global-ini-'));
  const repoIniPath = path.join(tmpDir, 'repo-global.ini');
  const targetIniPath = path.join(tmpDir, 'game-global.ini');

  await assert.rejects(() => deployGlobalIni({ repoIniPath, targetIniPath }), /repo file is missing/);

  await fs.writeFile(repoIniPath, 'enriched');
  await assert.rejects(
    () =>
      deployGlobalIni({
        repoIniPath,
        targetIniPath,
        copyFile: async () => {
          throw new Error('target read-only');
        },
      }),
    /Failed to deploy global\.ini: target read-only/,
  );
});
