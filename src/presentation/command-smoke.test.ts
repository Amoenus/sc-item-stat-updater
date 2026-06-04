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
});

test('update-item help exits successfully and lists categories', async () => {
  const result = await runCommand(['bin/update-item.ts', '--help']);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Usage: node update-item\.js \[options] <category>/);
  assert.match(result.stdout, /Available categories:/);
  assert.match(result.stdout, /sp-coolers/);
  assert.match(result.stdout, /mission-scmdb-descriptions/);
});

test('pipeline help exits successfully with orchestration options', async () => {
  const result = await runCommand(['bin/pipeline.ts', '--help']);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Usage: node --import tsx\/esm bin\/pipeline\.ts \[options]/);
  assert.match(result.stdout, /--scrape\s+Run scrape:scmdb and scrape:spviewer before updating/);
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
