import assert from 'node:assert/strict';
import test from 'node:test';
import { refreshSourceCache } from './refresh-source-cache';
import type { runDatacoreScrape } from './run-datacore-scrape';
import type { runScmdbScrape } from './run-scmdb-scrape';

type DatacoreResult = Awaited<ReturnType<typeof runDatacoreScrape>>;
type ScmdbResult = Awaited<ReturnType<typeof runScmdbScrape>>;

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function yieldToScheduledJobs(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function waitForEvent(events: string[], event: string): Promise<void> {
  for (let attempt = 0; attempt < 10 && !events.includes(event); attempt++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

test('refreshSourceCache refreshes SCMDB and DataCore concurrently for all sources', async () => {
  const scmdbGate = deferred();
  const datacoreGate = deferred();
  const events: string[] = [];

  const resultPromise = refreshSourceCache({
    repoRoot: 'repo',
    target: 'all',
    runScmdb: async () => {
      events.push('scmdb:start');
      await scmdbGate.promise;
      events.push('scmdb:end');
      return {} as ScmdbResult;
    },
    runDatacore: async () => {
      events.push('datacore:start');
      await datacoreGate.promise;
      events.push('datacore:end');
      return { exitCode: 0 } as DatacoreResult;
    },
    onSourceStart: (source) => events.push(`${source}:source-start`),
    onSourceComplete: (source) => events.push(`${source}:source-complete`),
  });

  await yieldToScheduledJobs();

  assert.ok(events.includes('scmdb:start'));
  assert.ok(events.includes('datacore:start'));
  assert.ok(!events.includes('scmdb:end'));
  assert.ok(!events.includes('datacore:end'));

  datacoreGate.resolve();
  scmdbGate.resolve();

  const result = await resultPromise;

  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.refreshed, ['scmdb', 'datacore']);
  assert.ok(events.indexOf('datacore:source-complete') < events.indexOf('scmdb:source-complete'));
});

test('refreshSourceCache respects a concurrency limit', async () => {
  const scmdbGate = deferred();
  const datacoreGate = deferred();
  const events: string[] = [];

  const resultPromise = refreshSourceCache({
    repoRoot: 'repo',
    target: 'all',
    concurrency: 1,
    runScmdb: async () => {
      events.push('scmdb:start');
      await scmdbGate.promise;
      events.push('scmdb:end');
      return {} as ScmdbResult;
    },
    runDatacore: async () => {
      events.push('datacore:start');
      await datacoreGate.promise;
      events.push('datacore:end');
      return { exitCode: 0 } as DatacoreResult;
    },
  });

  await yieldToScheduledJobs();

  assert.deepEqual(events, ['scmdb:start']);

  scmdbGate.resolve();
  await waitForEvent(events, 'datacore:start');

  assert.equal(events[0], 'scmdb:start');
  assert.ok(events.indexOf('scmdb:end') < events.indexOf('datacore:start'));

  datacoreGate.resolve();

  const result = await resultPromise;

  assert.deepEqual(result, { exitCode: 0, refreshed: ['scmdb', 'datacore'] });
});

test('refreshSourceCache can refresh a single DataCore source', async () => {
  let scmdbCalled = false;
  const result = await refreshSourceCache({
    repoRoot: 'repo',
    target: 'datacore',
    runScmdb: async () => {
      scmdbCalled = true;
      return {} as ScmdbResult;
    },
    runDatacore: async () => ({ exitCode: 0 }) as DatacoreResult,
  });

  assert.equal(scmdbCalled, false);
  assert.deepEqual(result, { exitCode: 0, refreshed: ['datacore'] });
});

test('refreshSourceCache returns the DataCore exit code when DataCore fails', async () => {
  const result = await refreshSourceCache({
    repoRoot: 'repo',
    target: 'all',
    runScmdb: async () => ({}) as ScmdbResult,
    runDatacore: async () => ({ exitCode: 7 }) as DatacoreResult,
  });

  assert.deepEqual(result, { exitCode: 7, refreshed: ['scmdb'] });
});
