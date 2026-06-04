import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildLookupFromCsvFiles } from './lookup-utils';

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test('buildLookupFromCsvFiles starts independent CSV loads in parallel', async () => {
  const baseDir = path.join(os.tmpdir(), 'spviewer-lookup-test');
  const first = deferred<Iterable<readonly [string, string]>>();
  const second = deferred<Iterable<readonly [string, string]>>();
  const started: string[] = [];

  const resultPromise = buildLookupFromCsvFiles(baseDir, ['first.spviewer.csv', 'second.spviewer.csv'], (_path, filename) => {
    started.push(filename);
    return filename === 'first.spviewer.csv' ? first.promise : second.promise;
  });

  assert.deepEqual(started, ['first.spviewer.csv', 'second.spviewer.csv']);

  second.resolve([['second-key', 'second value']]);
  first.resolve([['first-key', 'first value']]);

  assert.deepEqual(await resultPromise, new Map(Object.entries({ 'first-key': 'first value', 'second-key': 'second value' })));
});

test('buildLookupFromCsvFiles preserves filename order when merging duplicate keys', async () => {
  const baseDir = path.join(os.tmpdir(), 'spviewer-lookup-test');

  const lookup = await buildLookupFromCsvFiles(baseDir, ['first.spviewer.csv', 'second.spviewer.csv'], async (_path, filename) =>
    filename === 'first.spviewer.csv' ? [['shared-key', 'first value']] : [['shared-key', 'second value']],
  );

  assert.deepEqual(lookup, new Map([['shared-key', 'second value']]));
});
