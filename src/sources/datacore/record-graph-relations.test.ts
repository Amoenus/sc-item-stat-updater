import assert from 'node:assert/strict';
import test from 'node:test';
import {
  graphGuidReferences,
  graphLocalizationKey,
  graphLocalizationKeyFromReferences,
  graphLocalizationKeyFromReferencesMatching,
  graphLocalizationKeyMatching,
  graphLocalizationKeys,
  graphLocalizationKeysFromReferences,
  graphLocalizationKeyWithFallback,
  hasGraphLocalizationReference,
  hasGraphLocalizationReferenceFromReferences,
  uniqueGraphGuidReference,
} from './record-graph-relations';
import type { DataCoreRecordNode } from './types';

test('uniqueGraphGuidReference uses fallback only when graph exposes no matching refs', () => {
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
  assert.equal(uniqueGraphGuidReference(record, ['owner'], 'fallback-owner-guid'), '');
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

test('graphGuidReferences normalizes graph attribute names before matching', () => {
  const record: DataCoreRecordNode = {
    path: 'record.xml',
    ref: 'record-guid',
    rootTag: 'Record.Test',
    rootType: 'Record',
    entityClass: 'Test',
    localizationKeys: [],
    referencedGuids: ['manufacturer-guid'],
    referencedGuidAttributes: [{ attribute: ' Manufacturer ', value: 'manufacturer-guid' }],
  };

  assert.deepEqual(graphGuidReferences(record, ['manufacturer']), ['manufacturer-guid']);
  assert.equal(uniqueGraphGuidReference(record, [' MANUFACTURER '], 'fallback-guid'), 'manufacturer-guid');
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

test('graphLocalizationKeys returns distinct keys in attribute priority order', () => {
  const record: DataCoreRecordNode = {
    path: 'record.xml',
    ref: 'record-guid',
    rootTag: 'Record.Test',
    rootType: 'Record',
    entityClass: 'Test',
    localizationKeys: [
      { attribute: 'displayName', key: '@display_one' },
      { attribute: 'Name', key: '@name_one' },
      { attribute: 'displayName', key: '@display_one' },
      { attribute: 'Name', key: 'LOC_PLACEHOLDER' },
      { attribute: 'Name', key: '@name_two' },
    ],
    referencedGuids: [],
  };

  assert.deepEqual(graphLocalizationKeys(record, ['Name', 'displayName']), ['name_one', 'name_two', 'display_one']);
  assert.deepEqual(graphLocalizationKeysFromReferences(record.localizationKeys, ['displayName']), ['display_one']);
});

test('graphLocalizationKeyWithFallback prefers graph keys and normalizes fallback keys', () => {
  const record: DataCoreRecordNode = {
    path: 'record.xml',
    ref: 'record-guid',
    rootTag: 'Record.Test',
    rootType: 'Record',
    entityClass: 'Test',
    localizationKeys: [{ attribute: 'displayName', key: '@graph_name' }],
    referencedGuids: [],
  };

  assert.equal(graphLocalizationKeyWithFallback(record, ['displayName'], '@xml_name'), 'graph_name');
  assert.equal(graphLocalizationKeyWithFallback(record, ['Name'], '@xml_name'), 'xml_name');
  assert.equal(graphLocalizationKeyWithFallback(record, ['Name'], '@LOC_PLACEHOLDER'), '');
});

test('graphLocalizationKeyWithFallback does not use fallback when graph role is placeholder', () => {
  const record: DataCoreRecordNode = {
    path: 'record.xml',
    ref: 'record-guid',
    rootTag: 'Record.Test',
    rootType: 'Record',
    entityClass: 'Test',
    localizationKeys: [{ attribute: 'Name', key: '@LOC_PLACEHOLDER' }],
    referencedGuids: [],
  };

  assert.equal(graphLocalizationKeyWithFallback(record, ['Name'], '@xml_name'), '');
  assert.equal(graphLocalizationKeyWithFallback(record, ['displayName'], '@xml_name'), 'xml_name');
});

test('hasGraphLocalizationReference treats placeholder keys as exposed graph relationships', () => {
  const record: DataCoreRecordNode = {
    path: 'record.xml',
    ref: 'record-guid',
    rootTag: 'Record.Test',
    rootType: 'Record',
    entityClass: 'Test',
    localizationKeys: [
      { attribute: 'Name', key: '@LOC_PLACEHOLDER' },
      { attribute: 'description', key: '' },
    ],
    referencedGuids: [],
  };

  assert.equal(graphLocalizationKey(record, ['Name']), '');
  assert.equal(hasGraphLocalizationReference(record, ['Name']), true);
  assert.equal(hasGraphLocalizationReferenceFromReferences(record.localizationKeys, ['description']), false);
  assert.equal(hasGraphLocalizationReference(record, ['displayName']), false);
});

test('graphLocalizationKeyMatching filters graph keys while preserving attribute priority', () => {
  const record: DataCoreRecordNode = {
    path: 'record.xml',
    ref: 'record-guid',
    rootTag: 'Record.Test',
    rootType: 'Record',
    entityClass: 'Test',
    localizationKeys: [
      { attribute: 'displayName', key: '@ui_generic_label' },
      { attribute: 'displayName', key: '@items_commodities_graph_label' },
      { attribute: 'Name', key: 'LOC_PLACEHOLDER' },
      { attribute: 'Name', key: '@items_commodities_name_label' },
    ],
    referencedGuids: [],
  };
  const isCommodityKey = (key: string) => key.startsWith('items_commodities_');

  assert.equal(
    graphLocalizationKeyMatching(record, ['displayName', 'Name'], isCommodityKey),
    'items_commodities_graph_label',
  );
  assert.equal(
    graphLocalizationKeyFromReferencesMatching(record.localizationKeys, ['Name', 'displayName'], isCommodityKey),
    'items_commodities_name_label',
  );
});
