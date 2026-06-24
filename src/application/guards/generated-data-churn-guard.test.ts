import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import {
  assertNoGeneratedDataChurn,
  classifyGeneratedDataPath,
  formatGeneratedDataChurnMessage,
  GeneratedDataChurnError,
  parseGitPorcelainStatus,
} from './generated-data-churn-guard';

const execFileAsync = promisify(execFile);

async function makeGitRepo(): Promise<string> {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'generated-churn-guard-'));
  await execFileAsync('git', ['init'], { cwd: repoRoot });
  await fs.mkdir(path.join(repoRoot, 'csv'), { recursive: true });
  await fs.writeFile(path.join(repoRoot, 'csv', 'tracked.csv'), 'id,value\n1,old\n');
  await fs.writeFile(path.join(repoRoot, 'global.ini'), 'item_desc_existing=Old value\n');
  await fs.writeFile(path.join(repoRoot, 'fixture-output.txt'), 'fixture writes are allowed here\n');
  await execFileAsync('git', ['add', '.'], { cwd: repoRoot });
  await execFileAsync(
    'git',
    ['-c', 'user.name=Codex', '-c', 'user.email=codex@example.test', 'commit', '-m', 'initial fixture'],
    { cwd: repoRoot },
  );
  return repoRoot;
}

test('parseGitPorcelainStatus extracts status and path names', () => {
  const changes = parseGitPorcelainStatus(' M global.ini\n?? csv/new.csv\nR  csv/old.csv -> csv/new-name.csv\nMM csv/datacore/.xmlcache/4.8.2-live/.metadata.json\n');
  assert.deepEqual(
    changes.map((change) => ({ status: change.status, path: change.path, ownershipClass: change.ownership.ownershipClass })),
    [
      { status: ' M', path: 'global.ini', ownershipClass: 'Committed artifact' },
      { status: '??', path: 'csv/new.csv', ownershipClass: 'Diagnostic-only output' },
      {
        status: 'MM',
        path: 'csv/datacore/.xmlcache/4.8.2-live/.metadata.json',
        ownershipClass: 'Rebuildable local cache',
      },
    ],
  );
});

test('formatGeneratedDataChurnMessage names changed generated-data paths', () => {
  assert.equal(
    formatGeneratedDataChurnMessage([
      { status: ' M', path: 'global.ini', ownership: classifyGeneratedDataPath('global.ini') },
      {
        status: '??',
        path: 'csv/datacore/.xmlcache/4.8.2-live/.metadata.json',
        ownership: classifyGeneratedDataPath('csv/datacore/.xmlcache/4.8.2-live/.metadata.json'),
      },
    ]),
    [
      'Generated-data churn detected after a no-write verification command.',
      '',
      '-  M global.ini [Committed artifact]',
      '- ?? csv/datacore/.xmlcache/4.8.2-live/.metadata.json [Rebuildable local cache]',
      '',
      'Ownership guidance:',
      '- Committed artifact: Commit only intentional localization artifact refreshes.',
      '- Rebuildable local cache: Do not commit by default; restore, remove, or explicitly exempt machine-local cache churn.',
      '',
      'Dry-run/help/test flows should not modify repository csv/ data or root global.ini.',
      'Use fixtures or temporary directories for intentional writes, or stage an intentional generated-data refresh before rerunning the guard.',
    ].join('\n'),
  );
});

test('classifyGeneratedDataPath maps documented ownership classes', () => {
  assert.equal(classifyGeneratedDataPath('csv/datacore/.dcbcache/4.8.2-live/Data/Game2.dcb').ownershipClass, 'Rebuildable local cache');
  assert.equal(classifyGeneratedDataPath('csv/datacore/4.8.2-live/record-graph.json').ownershipClass, 'Derived source output');
  assert.equal(classifyGeneratedDataPath('csv/datacore/4.8.2-live/power-plants.datacore.csv').ownershipClass, 'Derived source output');
  assert.equal(classifyGeneratedDataPath('csv/scmdb/4.8.2-live/merged-vehicles.json').ownershipClass, 'Raw source snapshot');
  assert.equal(classifyGeneratedDataPath('csv/scmdb/4.8.2-live/scmdb-vehicles.csv').ownershipClass, 'Derived source output');
  assert.equal(classifyGeneratedDataPath('csv/provider-diff/report.json').ownershipClass, 'Diagnostic-only output');
});

test('assertNoGeneratedDataChurn ignores fixture writes outside csv and global.ini', async () => {
  const repoRoot = await makeGitRepo();
  try {
    await fs.writeFile(path.join(repoRoot, 'fixture-output.txt'), 'changed fixture output\n');
    await fs.mkdir(path.join(repoRoot, 'tmp-fixtures'), { recursive: true });
    await fs.writeFile(path.join(repoRoot, 'tmp-fixtures', 'global.ini'), 'temp ini change\n');

    await assert.doesNotReject(assertNoGeneratedDataChurn(repoRoot));
  } finally {
    await fs.rm(repoRoot, { recursive: true, force: true });
  }
});

test('assertNoGeneratedDataChurn rejects with changed csv and global.ini paths', async () => {
  const repoRoot = await makeGitRepo();
  try {
    await fs.writeFile(path.join(repoRoot, 'global.ini'), 'item_desc_existing=New value\n');
    await fs.writeFile(path.join(repoRoot, 'csv', 'new-output.csv'), 'id,value\n2,new\n');

    await assert.rejects(assertNoGeneratedDataChurn(repoRoot), (error: Error) => {
      assert.equal(error instanceof GeneratedDataChurnError, true);
      assert.match(error.message, /Generated-data churn detected/);
      assert.match(error.message, /global\.ini/);
      assert.match(error.message, /csv\/new-output\.csv/);
      return true;
    });
  } finally {
    await fs.rm(repoRoot, { recursive: true, force: true });
  }
});

test('assertNoGeneratedDataChurn treats staged generated files as the intentional baseline', async () => {
  const repoRoot = await makeGitRepo();
  try {
    await fs.writeFile(path.join(repoRoot, 'csv', 'tracked.csv'), 'id,value\n1,intentional\n');
    await execFileAsync('git', ['add', 'csv/tracked.csv'], { cwd: repoRoot });

    await assert.doesNotReject(assertNoGeneratedDataChurn(repoRoot));

    await fs.writeFile(path.join(repoRoot, 'csv', 'tracked.csv'), 'id,value\n1,intentional\n2,new unstaged churn\n');
    await assert.rejects(assertNoGeneratedDataChurn(repoRoot), (error: Error) => {
      assert.match(error.message, /csv\/tracked\.csv/);
      return true;
    });
  } finally {
    await fs.rm(repoRoot, { recursive: true, force: true });
  }
});
