import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { getLogger, setJsonOutput, setLogLevel, shutdownLogger } from './logger';

function captureStderr(run: () => void): string {
  const originalWrite = process.stderr.write;
  let output = '';

  process.stderr.write = ((chunk: string | Uint8Array) => {
    output += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    return true;
  }) as typeof process.stderr.write;

  try {
    run();
  } finally {
    process.stderr.write = originalWrite;
  }

  return output;
}

afterEach(() => {
  setLogLevel('info');
  setJsonOutput(false);
});

test('logger writes formatted text records to stderr', () => {
  const output = captureStderr(() => {
    getLogger('fixture').info('hello', { count: 2, empty: '', skipped: null });
  });

  assert.match(output, /\[INFO]/);
  assert.match(output, /hello \(count=2\)/);
  assert.doesNotMatch(output, /empty=/);
  assert.doesNotMatch(output, /skipped=/);
});

test('logger supports JSON records for log aggregation', () => {
  setJsonOutput(true);

  const output = captureStderr(() => {
    getLogger('fixture-json').warn('careful', { dryRun: true });
  });

  const entry = JSON.parse(output);
  assert.equal(entry.severity, 'WARN');
  assert.equal(entry.body, 'careful');
  assert.equal(entry.logger, 'fixture-json');
  assert.deepEqual(entry.attributes, { dryRun: true });
  assert.equal(typeof entry.timestamp, 'string');
});

test('logger filters debug records unless verbose logging is enabled', () => {
  const hidden = captureStderr(() => {
    getLogger('fixture').debug('hidden');
  });
  assert.equal(hidden, '');

  setLogLevel('debug');
  const visible = captureStderr(() => {
    getLogger('fixture').debug('visible');
  });

  assert.match(visible, /\[DEBUG]/);
  assert.match(visible, /visible/);
});

test('shutdownLogger remains awaitable for CLI compatibility', async () => {
  await assert.doesNotReject(shutdownLogger());
});
