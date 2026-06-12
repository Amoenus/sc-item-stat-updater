import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

function runCommand(args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx/esm', ...args], {
      cwd: repoRoot,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({
        exitCode,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
      });
    });
  });
}

test('update-all help exits successfully with user-facing options', async () => {
  const result = await runCommand(['bin/update-all.ts', '--help']);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Usage: node update-all\.js \[options]/);
  assert.match(result.stdout, /--dry-run\s+Preview changes without writing/);
  assert.match(result.stdout, /--emit-artifact <path>/);
  assert.doesNotMatch(result.stdout, /--refresh-scmdb-mining-locations/);
});

test('update-item help exits successfully and lists categories', async () => {
  const result = await runCommand(['bin/update-item.ts', '--help']);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Usage: node update-item\.js \[options] <category>/);
  assert.match(result.stdout, /Available active update categories:/);
  assert.match(result.stdout, /dc-powerplants/);
  assert.match(result.stdout, /mission-datacore-descriptions/);
});

test('update-item rejects mining journal helper as a direct category', async () => {
  const result = await runCommand(['bin/update-item.ts', 'mission-mining-journal', '--dry-run']);

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /Unknown category: mission-mining-journal/);
});

test('update-item list-categories reports provider and source metadata', async () => {
  const result = await runCommand(['bin/update-item.ts', '--list-categories']);

  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /DataCore active categories:/);
  assert.match(result.stdout, /dc-powerplants \| DC Power Plants \| files: powerplant\.datacore\.csv/);
  assert.match(result.stdout, /mission-datacore-descriptions \| DataCore mission descriptions/);
  assert.match(result.stdout, /DataCore raw fact datasets:/);
  assert.match(result.stdout, /datacore-vehicles \| Vehicles \| files: vehicles\.datacore\.csv/);
  assert.match(result.stdout, /datacore-location-labels \| Law and location labels/);
  assert.match(result.stdout, /Mixed-source batch modes:/);
  assert.match(result.stdout, /update-all \| DataCore \+ SCMDB/);
  assert.doesNotMatch(result.stdout, /update-all --provider spviewer/);
});

test('update-item provider-matrix reports coverage status by provider', async () => {
  const result = await runCommand(['bin/update-item.ts', '--provider-matrix']);

  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /Provider coverage matrix/);
  assert.match(result.stdout, /\| Coolers \| primary \(dc-coolers\) \| unavailable \|/);
  assert.match(
    result.stdout,
    /\| DataCore mission descriptions \| primary \(mission-datacore-descriptions\) \| unavailable \|/,
  );
  assert.match(result.stdout, /Mixed-source batch modes:/);
});

test('update-item dynamic-audit reports dynamic coverage status', async () => {
  const result = await runCommand(['bin/update-item.ts', '--dynamic-audit']);

  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /Dynamic coverage audit/);
  assert.match(result.stdout, /mission-datacore-descriptions \(DataCore mission descriptions\)/);
  assert.match(result.stdout, /Summary: \d+ dynamic, 0 need review, 0 known source gaps\./);
  assert.equal(result.stderr, '');
});

test('update-item scmdb-audit reports remaining SCMDB dependencies', async () => {
  const result = await runCommand(['bin/update-item.ts', '--scmdb-audit']);

  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /SCMDB dependency audit/);
  assert.match(result.stdout, /DataCore\/Data\.p4k: authoritative source/);
  assert.match(
    result.stdout,
    /\| update category \| mission-datacore-descriptions \(DataCore mission descriptions\) \| datacore:contract-generator-intel\.datacore\.csv, datacore:mission-contract-intel\.datacore\.csv, optional:datacore:contract-hauling-summary\.datacore\.csv, datacore:contract-generators\.datacore\.csv, datacore:blueprint-pools\.datacore\.csv, datacore:crafting-blueprints\.datacore\.csv \| Already extractable from DataCore \| yes \|/,
  );
  assert.equal(result.stderr, '');
});

test('pipeline help exits successfully with orchestration options', async () => {
  const result = await runCommand(['bin/pipeline.ts', '--help']);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Usage: node --import tsx\/esm bin\/pipeline\.ts \[options]/);
  assert.match(result.stdout, /--scrape\s+Run scrape:scmdb and scrape:datacore before updating/);
  assert.match(result.stdout, /--dry-run\s+Preview changes without writing/);
});

test('apply-artifact dry run reports changes without writing the INI fixture', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'command-smoke-'));
  try {
    const artifactPath = path.join(tempDir, 'patch-data.json');
    const iniPath = path.join(tempDir, 'global.ini');
    const originalIni = 'item_desc_existing=Old value\nitem_name_existing=Existing';
    await fs.writeFile(
      artifactPath,
      JSON.stringify({
        generatedAt: '2026-06-04T00:00:00.000Z',
        scmdbVersion: 'test-scmdb',
        spviewerVersion: null,
        entries: {
          item_desc_existing: 'Updated value',
          item_desc_missing: 'Skipped value',
        },
        stats: {
          categoryCount: 1,
          totalEntries: 2,
          totalSkipped: 0,
          totalErrors: 0,
        },
        issues: [{ label: 'fixture', key: 'artifact_issue_key', reason: 'Generated issue', type: 'warning' }],
      }),
      'utf8',
    );
    await fs.writeFile(iniPath, originalIni, 'utf8');

    const result = await runCommand(['bin/apply-artifact.ts', artifactPath, '--dry-run', '--ini-path', iniPath]);

    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /Artifact:/);
    assert.match(result.stdout, /Entries:\s+2/);
    assert.match(result.stdout, /Preview summary:/);
    assert.match(result.stdout, /Changed:\s+1 \(item_desc_existing\)/);
    assert.match(result.stdout, /Inserted:\s+0 \(none\)/);
    assert.match(result.stdout, /Skipped:\s+1 \(item_desc_missing\)/);
    assert.match(result.stdout, /Issues:\s+2/);
    assert.match(result.stdout, /Loader: Updated 1, Inserted 0, Skipped 1 \(dry run\)/);
    assert.match(result.stdout, /WARNING \| artifact_issue_key/);
    assert.match(result.stdout, /MISSING \| item_desc_missing/);
    assert.equal(await fs.readFile(iniPath, 'utf8'), originalIni);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
