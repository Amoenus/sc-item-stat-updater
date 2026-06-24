import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '..');

interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

function runArchitectureCheck(): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx/esm', 'scripts/check-architecture.ts'], {
      cwd: repoRoot,
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

test('architecture guard verifies lifecycle and source-contract invariants', async () => {
  const result = await runArchitectureCheck();

  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /Architecture guardrails passed/);
  assert.equal(result.stderr, '');
});
