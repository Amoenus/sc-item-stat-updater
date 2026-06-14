import assert from 'node:assert';
import test from 'node:test';
import { buildDataCoreHaulingComponentClassLookup, resolveDataCoreComponentClass } from './component-class-resolver';
import { createDataCoreRelationshipIndex } from './relationship-index';
import type { DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';

test('DataCore component class resolver uses hauling entity-class relationships when AttachDef class is undefined', () => {
  const cooler = node({
    path: 'libs/foundry/records/entities/scitem/ships/cooler/cool_acom_s01_iceplunge.xml',
    ref: 'component-guid',
    rootType: 'EntityClassDefinition',
    entityClass: 'COOL_ACOM_S01_IcePlunge_SCItem',
  });
  const haulingClass = node({
    path: 'libs/foundry/records/hauling/HaulingEntityClass_Cooler_S1_Competition.xml',
    ref: 'hauling-guid',
    rootType: 'Hauling_EntityClasses',
    entityClass: 'HaulingEntityClass_Cooler_S1_Competition',
    referencedGuids: ['component-guid'],
  });
  const relationships = createDataCoreRelationshipIndex(graphLookup([cooler, haulingClass]));

  const haulingClasses = buildDataCoreHaulingComponentClassLookup(relationships);

  assert.equal(resolveDataCoreComponentClass('UNDEFINED', 'COOL_ACOM_S01_IcePlunge', haulingClasses), 'Competition');
});

test('DataCore component class resolver keeps explicit AttachDef classes', () => {
  const haulingClasses = new Map([['cool_acom_s01_iceplunge', 'Competition']]);

  assert.equal(resolveDataCoreComponentClass('Military', 'COOL_ACOM_S01_IcePlunge', haulingClasses), 'Military');
});

test('DataCore component class resolver returns empty when no class relationship is known', () => {
  assert.equal(resolveDataCoreComponentClass('UNDEFINED', 'COOL_AEGS_S04_Idris', new Map()), '');
});

function graphLookup(records: DataCoreRecordNode[]): DataCoreRecordGraphLookup {
  return {
    graph: {
      source: 'datacore-record-graph',
      recordCount: records.length,
      records,
      indexes: {
        byRootType: {},
        byRef: {},
        byPath: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    },
    getByRootType(rootType) {
      return records.filter((record) => record.rootType === rootType);
    },
    getByRef(ref) {
      return records.find((record) => record.ref === ref);
    },
    getByPath(recordPath) {
      return records.find((record) => record.path === recordPath);
    },
    getByEntityClass(entityClass) {
      return records.filter((record) => record.entityClass === entityClass);
    },
    getByLocalizationKey() {
      return [];
    },
    getByReferencedGuid(guid) {
      return records.filter((record) => record.referencedGuids.includes(guid));
    },
    getByPathPrefix(pathPrefix) {
      return records.filter((record) => record.path.startsWith(pathPrefix));
    },
    getByAttributeName() {
      return [];
    },
    getByAttributeValue() {
      return [];
    },
    getLocalizationReferencesByAttributeName() {
      return [];
    },
    getGuidReferencesByAttributeName() {
      return [];
    },
  };
}

function node({
  path,
  ref,
  rootType,
  entityClass,
  referencedGuids = [],
}: {
  path: string;
  ref: string;
  rootType: string;
  entityClass: string;
  referencedGuids?: string[];
}): DataCoreRecordNode {
  return {
    path,
    ref,
    rootTag: rootType,
    rootType,
    entityClass,
    localizationKeys: [],
    referencedGuidAttributes: [],
    referencedGuids,
  };
}
