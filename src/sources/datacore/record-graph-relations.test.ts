import assert from 'node:assert/strict';
import test from 'node:test';
import {
  graphGuidReferences,
  graphLocalizationKey,
  graphLocalizationKeyFromReferences,
  uniqueGraphGuidReference,
} from './record-graph-relations';
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

test('graphGuidReferences returns distinct non-empty graph refs in source order', () => {
  const record: DataCoreRecordNode = {
    path: 'record.xml',
    ref: 'record-guid',
    rootTag: 'Record.Test',
    rootType: 'Record',
    entityClass: 'Test',
    localizationKeys: [],
    referencedGuids: ['resource-a', 'resource-b'],
    referencedGuidAttributes: [
      { attribute: 'entry', value: '' },
      { attribute: 'entry', value: ' resource-a ' },
      { attribute: 'entry', value: 'resource-a' },
      { attribute: 'entry', value: 'resource-b' },
      { attribute: 'other', value: 'ignored-resource' },
    ],
  };

  assert.deepEqual(graphGuidReferences(record, ['entry']), ['resource-a', 'resource-b']);
});

test('graphLocalizationKey follows requested attribute priority before graph key order', () => {
  const record: DataCoreRecordNode = {
    path: 'record.xml',
    ref: 'record-guid',
    rootTag: 'Record.Test',
    rootType: 'Record',
    entityClass: 'Test',
    localizationKeys: [
      { attribute: 'displayName', key: 'aaa_display_name' },
      { attribute: 'Name', key: 'LOC_PLACEHOLDER' },
      { attribute: 'Name', key: '@zzz_name' },
      { attribute: 'description', key: 'record_desc' },
    ],
    referencedGuids: [],
  };

  assert.equal(graphLocalizationKey(record, ['Name', 'displayName']), 'zzz_name');
  assert.equal(graphLocalizationKeyFromReferences(record.localizationKeys, ['Name', 'displayName']), 'zzz_name');
  assert.equal(graphLocalizationKey(record, ['displayName', 'Name']), 'aaa_display_name');
  assert.equal(graphLocalizationKey(record, ['ShortName']), '');
});
