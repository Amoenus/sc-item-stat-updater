import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import { createDataCoreRelationshipIndex } from './relationship-index';
import type { DataCoreRecordGraph } from './types';

describe('DataCore relationship index', () => {
  it('resolves records and relationships using normalized DataCore graph fields', () => {
    const graph = createDataCoreRecordGraphLookup(makeGraph());
    const index = createDataCoreRelationshipIndex(graph);

    const shipItem = index.getRecordForEntityClass('POWR_AEGS_S01_Charger');
    const haulingClass = index.getReferencingRecords(shipItem).at(0);

    assert.equal(shipItem?.path, 'items/powr_aegs_s01_charger.xml');
    assert.equal(index.getRecordForEntityClass('POWR_AEGS_S01_Charger_SCItem')?.path, shipItem?.path);
    assert.deepEqual(
      index.getRecordsByRootType('Hauling_EntityClasses').map((record) => record.path),
      ['hauling/powerplant_s01_military.xml'],
    );
    assert.deepEqual(
      index.getRecordsByLocalizationKey('@item_NamePOWR_AEGS_S01_Charger_SCItem').map((record) => record.path),
      ['items/powr_aegs_s01_charger.xml'],
    );
    assert.deepEqual(
      index.getRecordsReferencingEntityClass('POWR_AEGS_S01_Charger').map((record) => record.path),
      ['hauling/powerplant_s01_military.xml'],
    );
    assert.deepEqual(index.getLocalizationKeysForRecord(shipItem), [
      'item_descpowr_aegs_s01_charger_scitem',
      'item_namepowr_aegs_s01_charger_scitem',
    ]);
    assert.deepEqual(
      index.getReferencedRecords(haulingClass).map((record) => record.path),
      ['items/powr_aegs_s01_charger.xml'],
    );
    assert.deepEqual(
      index.getReferencingRecords(shipItem).map((record) => record.path),
      ['hauling/powerplant_s01_military.xml'],
    );
    assert.deepEqual(index.getRelationshipSummary(), {
      totalRecords: 2,
      recordsWithLocalizationKeys: 1,
      localizationKeyReferences: 2,
      referencedGuidReferences: 1,
      inboundReferenceTargets: 1,
      rootTypes: {
        EntityClassDefinition: 1,
        Hauling_EntityClasses: 1,
      },
    });
  });

  it('returns empty results when no graph is available', () => {
    const index = createDataCoreRelationshipIndex(null);

    assert.equal(index.getRecordForEntityClass('POWR_AEGS_S01_Charger'), undefined);
    assert.deepEqual(index.getRecordsByRootType('EntityClassDefinition'), []);
    assert.deepEqual(index.getRecordsByLocalizationKey('item_NamePOWR_AEGS_S01_Charger_SCItem'), []);
    assert.deepEqual(index.getRecordsReferencingEntityClass('POWR_AEGS_S01_Charger'), []);
    assert.deepEqual(index.getLocalizationKeysForRecord(undefined), []);
    assert.deepEqual(index.getReferencedRecords(undefined), []);
    assert.deepEqual(index.getReferencingRecords(undefined), []);
    assert.deepEqual(index.getRelationshipSummary(), {
      totalRecords: 0,
      recordsWithLocalizationKeys: 0,
      localizationKeyReferences: 0,
      referencedGuidReferences: 0,
      inboundReferenceTargets: 0,
      rootTypes: {},
    });
  });
});

function makeGraph(): DataCoreRecordGraph {
  return {
    source: 'datacore-record-graph',
    recordCount: 2,
    records: [
      {
        path: 'hauling/powerplant_s01_military.xml',
        ref: 'hauling-ref',
        rootTag: 'Hauling_EntityClasses.HaulingEntityClass_PowerPlant_S01_Military',
        rootType: 'Hauling_EntityClasses',
        entityClass: 'HaulingEntityClass_PowerPlant_S01_Military',
        localizationKeys: [],
        referencedGuids: ['charger-ref'],
      },
      {
        path: 'items/powr_aegs_s01_charger.xml',
        ref: 'charger-ref',
        rootTag: 'EntityClassDefinition.POWR_AEGS_S01_Charger_SCItem',
        rootType: 'EntityClassDefinition',
        entityClass: 'POWR_AEGS_S01_Charger_SCItem',
        localizationKeys: [
          { attribute: 'Name', key: '@item_NamePOWR_AEGS_S01_Charger_SCItem' },
          { attribute: 'Description', key: 'item_DescPOWR_AEGS_S01_Charger_SCItem' },
        ],
        referencedGuids: [],
      },
    ],
    indexes: {
      byRef: {
        'hauling-ref': 'hauling/powerplant_s01_military.xml',
        'charger-ref': 'items/powr_aegs_s01_charger.xml',
      },
      byPath: {
        'hauling/powerplant_s01_military.xml': 0,
        'items/powr_aegs_s01_charger.xml': 1,
      },
      byRootType: {
        Hauling_EntityClasses: ['hauling/powerplant_s01_military.xml'],
        EntityClassDefinition: ['items/powr_aegs_s01_charger.xml'],
      },
      byEntityClass: {
        HaulingEntityClass_PowerPlant_S01_Military: ['hauling/powerplant_s01_military.xml'],
        POWR_AEGS_S01_Charger_SCItem: ['items/powr_aegs_s01_charger.xml'],
      },
      byLocalizationKey: {
        item_NamePOWR_AEGS_S01_Charger_SCItem: ['items/powr_aegs_s01_charger.xml'],
        item_DescPOWR_AEGS_S01_Charger_SCItem: ['items/powr_aegs_s01_charger.xml'],
      },
      byReferencedGuid: {
        'charger-ref': ['hauling/powerplant_s01_military.xml'],
      },
    },
  };
}
