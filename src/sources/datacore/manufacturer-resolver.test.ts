import assert from 'node:assert/strict';
import test from 'node:test';
import { createDataCoreManufacturerResolver } from './manufacturer-resolver';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

test('createDataCoreManufacturerResolver resolves SCItemManufacturer records by first-party identifiers', () => {
  const resolver = createDataCoreManufacturerResolver(createDataCoreRecordGraphLookup(makeGraph()));

  assert.equal(resolver.all().length, 3);
  assert.equal(resolver.getByRef('cf4a74bf-eb2c-462a-9b78-f7f2724c31d2')?.code, 'AEGS');
  assert.equal(resolver.getByCode('aegs')?.ref, 'cf4a74bf-eb2c-462a-9b78-f7f2724c31d2');
  assert.equal(resolver.getByNameLocalizationKey('@manufacturer_NameAEGS')?.code, 'AEGS');
  assert.equal(resolver.getByDescriptionLocalizationKey('manufacturer_DescRSI')?.code, 'RSI');
  assert.equal(resolver.resolve('manufacturer_DescAEGS')?.code, 'AEGS');
  assert.equal(resolver.resolve('RSI')?.nameKey, 'manufacturer_NameRSI');
  assert.equal(resolver.resolve('manufacturer_NameARGO_Display')?.code, 'ARGO');
  assert.equal(resolver.resolve('manufacturer_DescARGO_Display')?.code, 'ARGO');
});

test('createDataCoreManufacturerResolver ignores non-manufacturer records', () => {
  const resolver = createDataCoreManufacturerResolver(createDataCoreRecordGraphLookup(makeGraph()));

  assert.equal(resolver.resolve('AEGS_Avenger'), undefined);
  assert.equal(resolver.resolve('vehicle_Name_AEGS_Avenger'), undefined);
});

function makeGraph(): DataCoreRecordGraph {
  const vehiclePath = 'libs/foundry/records/entities/spaceships/aegs_avenger.xml';
  const aegisPath = 'libs/foundry/records/scitemmanufacturer/scitemmanufacturer.aegs.xml';
  const rsiPath = 'libs/foundry/records/scitemmanufacturer/scitemmanufacturer.rsi.xml';
  const argoPath = 'libs/foundry/records/scitemmanufacturer/scitemmanufacturer.argo.xml';

  return {
    source: 'datacore-record-graph',
    recordCount: 4,
    records: [
      {
        path: vehiclePath,
        ref: '11111111-1111-1111-1111-111111111111',
        rootTag: 'EntityClassDefinition.AEGS_Avenger',
        rootType: 'EntityClassDefinition',
        entityClass: 'AEGS_Avenger',
        localizationKeys: [{ attribute: 'vehicleName', key: 'vehicle_Name_AEGS_Avenger' }],
        referencedGuids: ['cf4a74bf-eb2c-462a-9b78-f7f2724c31d2'],
      },
      {
        path: aegisPath,
        ref: 'cf4a74bf-eb2c-462a-9b78-f7f2724c31d2',
        rootTag: 'SCItemManufacturer.AEGS',
        rootType: 'SCItemManufacturer',
        entityClass: 'AEGS',
        localizationKeys: [
          { attribute: 'Description', key: 'manufacturer_DescAEGS' },
          { attribute: 'Name', key: 'manufacturer_NameAEGS' },
        ],
        referencedGuids: [],
      },
      {
        path: rsiPath,
        ref: '7bbf6d5f-8b53-4e30-a560-42fd49640180',
        rootTag: 'SCItemManufacturer.RSI',
        rootType: 'SCItemManufacturer',
        entityClass: 'RSI',
        localizationKeys: [
          { attribute: 'Description', key: 'manufacturer_DescRSI' },
          { attribute: 'Name', key: 'manufacturer_NameRSI' },
        ],
        referencedGuids: [],
      },
      {
        path: argoPath,
        ref: '22222222-2222-2222-2222-222222222222',
        rootTag: 'SCItemManufacturer.ARGO',
        rootType: 'SCItemManufacturer',
        entityClass: 'ARGO',
        localizationKeys: [
          { attribute: 'Name', key: 'LOC_PLACEHOLDER' },
          { attribute: 'displayDescription', key: 'manufacturer_DescARGO_Display' },
          { attribute: 'displayName', key: 'manufacturer_NameARGO_Display' },
        ],
        referencedGuids: [],
      },
    ],
    indexes: {
      byRef: {
        '11111111-1111-1111-1111-111111111111': vehiclePath,
        'cf4a74bf-eb2c-462a-9b78-f7f2724c31d2': aegisPath,
        '7bbf6d5f-8b53-4e30-a560-42fd49640180': rsiPath,
        '22222222-2222-2222-2222-222222222222': argoPath,
      },
      byPath: {
        [vehiclePath]: 0,
        [aegisPath]: 1,
        [rsiPath]: 2,
        [argoPath]: 3,
      },
      byRootType: {
        EntityClassDefinition: [vehiclePath],
        SCItemManufacturer: [aegisPath, rsiPath, argoPath],
      },
      byEntityClass: {
        AEGS_Avenger: [vehiclePath],
        AEGS: [aegisPath],
        RSI: [rsiPath],
        ARGO: [argoPath],
      },
      byLocalizationKey: {
        vehicle_Name_AEGS_Avenger: [vehiclePath],
        manufacturer_NameAEGS: [aegisPath],
        manufacturer_DescAEGS: [aegisPath],
        manufacturer_NameRSI: [rsiPath],
        manufacturer_DescRSI: [rsiPath],
        manufacturer_NameARGO_Display: [argoPath],
        manufacturer_DescARGO_Display: [argoPath],
      },
      byReferencedGuid: {
        'cf4a74bf-eb2c-462a-9b78-f7f2724c31d2': [vehiclePath],
      },
    },
  };
}
