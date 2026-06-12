import assert from 'node:assert/strict';
import test from 'node:test';
import type { CommandIO } from '../cli';
import { runExtractGlobalIniCommand } from './extract-global-ini';

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

test('extract-global-ini command prints help without invoking extraction', async () => {
  const io = createFakeIO();
  let called = false;

  const exitCode = await runExtractGlobalIniCommand(['--help'], io, {
    extractGlobalIni: async () => {
      called = true;
      return 'unused';
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(called, false);
  assert.match(io.stdoutText(), /Usage: node --import tsx\/esm bin\/extract-global-ini\.ts \[Data\.p4k]/);
  assert.equal(io.stderrText(), '');
});

test('extract-global-ini command routes extraction logs through command IO', async () => {
  const io = createFakeIO();

  const exitCode = await runExtractGlobalIniCommand(['C:/Games/Data.p4k'], io, {
    extractGlobalIni: async (p4kFile, log) => {
      assert.equal(p4kFile, 'C:/Games/Data.p4k');
      assert.ok(log);
      log('Extracting: global.ini');
      return 'C:/Games/Data/Localization/english/global.ini';
    },
  });

  assert.equal(exitCode, 0);
  assert.match(io.stdoutText(), /\[extract-global-ini] Extracting: global\.ini/);
  assert.equal(io.stderrText(), '');
});

test('extract-global-ini command maps extraction failures to exit code 1', async () => {
  const io = createFakeIO();

  const exitCode = await runExtractGlobalIniCommand([], io, {
    extractGlobalIni: async () => {
      throw new Error('Data.p4k not found');
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(io.stdoutText(), '');
  assert.match(io.stderrText(), /\[extract-global-ini] ERROR: Data\.p4k not found/);
});
