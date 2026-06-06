import assert from 'node:assert/strict';
import test from 'node:test';
import { isLiveVersion, isPtuVersion, type ScmdbVersionEntry, selectScmdbVersion } from './version-selection';

const versions: ScmdbVersionEntry[] = [
  { version: '4.8.1-live.11875683', file: 'merged-4.8.1-live.11875683.json' },
  { version: '4.8.2-ptu.11900000', file: 'merged-4.8.2-ptu.11900000.json' },
];

test('SCMDB version channel helpers classify live and PTU versions', () => {
  assert.equal(isLiveVersion('4.8.1-live.11875683'), true);
  assert.equal(isLiveVersion('4.8.1-ptu.11875683'), false);
  assert.equal(isPtuVersion('4.8.2-ptu.11900000'), true);
  assert.equal(isPtuVersion('4.8.2-live.11900000'), false);
});

test('selectScmdbVersion returns an explicit requested version', () => {
  assert.deepEqual(selectScmdbVersion(versions, { version: '4.8.2-ptu.11900000' }), versions[1]);
});

test('selectScmdbVersion selects PTU when requested', () => {
  assert.deepEqual(selectScmdbVersion(versions, { ptu: true }), versions[1]);
});

test('selectScmdbVersion selects the first live version by default', () => {
  assert.deepEqual(selectScmdbVersion(versions), versions[0]);
});

test('selectScmdbVersion falls back to the first version when no live entry exists', () => {
  const ptuOnly = [{ version: '4.8.2-ptu.11900000', file: 'merged-4.8.2-ptu.11900000.json' }];
  assert.deepEqual(selectScmdbVersion(ptuOnly), ptuOnly[0]);
});

test('selectScmdbVersion reports missing requested data clearly', () => {
  assert.throws(() => selectScmdbVersion([], { version: 'missing' }), /Version not found: missing/);
  assert.throws(() => selectScmdbVersion([], { ptu: true }), /No PTU SCMDB version available/);
  assert.throws(() => selectScmdbVersion([]), /No SCMDB versions available/);
});
