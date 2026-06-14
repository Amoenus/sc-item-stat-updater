import assert from 'node:assert/strict';
import test from 'node:test';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import { queryDataCoreRecords } from './record-graph-query';
import type { DataCoreRecordGraph } from './types';

test('queryDataCoreRecords filters by prefix, root type, predicate, uniqueness, and path order', () => {
  const graph = createDataCoreRecordGraphLookup(makeGraph());

  assert.deepEqual(
    queryDataCoreRecords(graph, {
      pathPrefix: 'records\\mining',
      rootTypes: ['MineableComposition', 'HarvestablePreset'],
      predicate: (record) => record.entityClass.includes('Rock'),
      unique: true,
    }).map((record) => record.path),
    ['records/mining/a.xml', 'records/mining/b.xml'],
  );
});

function makeGraph(): DataCoreRecordGraph {
  return {
    source: 'datacore-record-graph',
    recordCount: 5,
    records: [
      makeRecord('records/mining/b.xml', 'MineableComposition', 'RockB', 'ref-b'),
      makeRecord('records/mining/a.xml', 'HarvestablePreset', 'RockA', 'ref-a'),
      makeRecord('records/mining/c.xml', 'OtherRoot', 'RockC', 'ref-c'),
      makeRecord('records/mining/d.xml', 'MineableComposition', 'PlantD', 'ref-d'),
      makeRecord('records/ships/e.xml', 'MineableComposition', 'RockE', 'ref-e'),
    ],
    indexes: {
      byRef: {},
      byPath: {},
      byRootType: {},
      byEntityClass: {},
      byLocalizationKey: {},
      byReferencedGuid: {},
    },
  };
}

function makeRecord(path: string, rootType: string, entityClass: string, ref: string) {
  return {
    path,
    ref,
    rootTag: `${rootType}.${entityClass}`,
    rootType,
    entityClass,
    localizationKeys: [],
    referencedGuids: [],
  };
}
