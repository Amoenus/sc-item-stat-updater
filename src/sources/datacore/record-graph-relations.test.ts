import assert from 'node:assert/strict';
import test from 'node:test';
import { uniqueGraphGuidReference } from './record-graph-relations';
import type { DataCoreRecordNode } from './types';

test('uniqueGraphGuidReference uses the only graph ref and otherwise falls back', () => {
  const record: DataCoreRecordNode = {
    path: 'record.xml',
    ref: 'record-guid',
    rootTag: 'Record.Test',
    rootType: 'Record',
    entityClass: 'Test',
    localizationKeys: [],
    referencedGuids: ['type-guid', 'owner-guid', 'alternate-owner-guid'],
    referencedGuidAttributes: [
      { attribute: 'type', value: '' },
      { attribute: 'type', value: 'type-guid' },
      { attribute: 'owner', value: 'owner-guid' },
      { attribute: 'owner', value: 'alternate-owner-guid' },
    ],
  };

  assert.equal(uniqueGraphGuidReference(record, ['type'], 'fallback-type-guid'), 'type-guid');
  assert.equal(uniqueGraphGuidReference(record, ['owner'], 'fallback-owner-guid'), 'fallback-owner-guid');
  assert.equal(uniqueGraphGuidReference(record, ['missing'], 'fallback-missing-guid'), 'fallback-missing-guid');
});
