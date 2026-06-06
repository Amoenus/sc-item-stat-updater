import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLookupMapFromRows } from './lookup-utils';

test('buildLookupMapFromRows skips null entries and keeps later duplicate rows', () => {
  const lookup = buildLookupMapFromRows(
    [
      { key: 'alpha', value: 'first' },
      { key: '', value: 'ignored' },
      { key: 'alpha', value: 'second' },
    ],
    (row) => (row.key ? [row.key, row.value] : null),
  );

  assert.deepEqual([...lookup.entries()], [['alpha', 'second']]);
});
