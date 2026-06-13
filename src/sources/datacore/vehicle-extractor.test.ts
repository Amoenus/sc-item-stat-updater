import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';
import { extractDataCoreVehicles } from './vehicle-extractor';

test('extractDataCoreVehicles reads first-party vehicle metadata and resolves manufacturers', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-vehicles-'));
  const vehiclePath = 'libs/foundry/records/entities/spaceships/aegs_avenger_titan.xml';
  await fs.mkdir(path.dirname(path.join(xmlCacheDir, vehiclePath)), { recursive: true });
  await fs.writeFile(
    path.join(xmlCacheDir, vehiclePath),
    `
      <EntityClassDefinition.AEGS_Avenger_Titan __type="EntityClassDefinition" __ref="11111111-1111-1111-1111-111111111111" __path="${vehiclePath}">
        <Components>
          <VehicleComponentParams
            manufacturer="stale-manufacturer-guid"
            movementClass="Spaceship"
            vehicleDefinition="scripts/entities/vehicles/implementations/xml/aegs_avenger.xml"
            modification="Titan"
            allowSoftDestruction="1"
            dogfightEnabled="1"
            isGravlevVehicle="0"
            vehicleHullDamageNormalizationValue="1650"
            crewSize="1"
            vehicleName="@vehicle_NameAEGS_Avenger_Titan_Stale"
            vehicleDescription="@vehicle_DescAEGS_Avenger_Titan_Stale"
            vehicleCareer="@vehicle_focus_transporter_stale"
            vehicleCareerRef="stale-career-guid"
            vehicleRole="@vehicle_class_lightfreight_stale"
            vehicleRoleRef="stale-role-guid"
            inventoryContainerParams="stale-inventory-container-guid" />
        </Components>
      </EntityClassDefinition.AEGS_Avenger_Titan>
    `,
    'utf8',
  );

  const rows = await extractDataCoreVehicles({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph(vehiclePath)),
  });

  assert.deepEqual(rows, [
    {
      ref: '11111111-1111-1111-1111-111111111111',
      path: vehiclePath,
      entityClass: 'AEGS_Avenger_Titan',
      vehicleNameKey: 'vehicle_NameAEGS_Avenger_Titan',
      vehicleDescriptionKey: 'vehicle_DescAEGS_Avenger_Titan',
      manufacturerGuid: 'cf4a74bf-eb2c-462a-9b78-f7f2724c31d2',
      manufacturerCode: 'AEGS',
      manufacturerNameKey: 'manufacturer_NameAEGS',
      movementClass: 'Spaceship',
      vehicleDefinition: 'scripts/entities/vehicles/implementations/xml/aegs_avenger.xml',
      modification: 'Titan',
      careerKey: 'vehicle_focus_transporter',
      careerGuid: 'd86d770d-1fc4-4525-b3b0-4f670a8a5634',
      roleKey: 'vehicle_class_lightfreight',
      roleGuid: 'ff99d78e-3a6a-4e4d-8b1c-59e87a005c11',
      crewSize: '1',
      hullDamageNormalization: '1650',
      allowSoftDestruction: '1',
      dogfightEnabled: '1',
      isGravlevVehicle: '0',
      inventoryContainerGuid: 'a623a5e1-27db-4e93-af6b-e54912b78e32',
    },
  ]);
});

test('extractDataCoreVehicles falls back when graph GUID refs are ambiguous', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-vehicles-ambiguous-'));
  const vehiclePath = 'libs/foundry/records/entities/spaceships/aegs_avenger_titan.xml';
  await fs.mkdir(path.dirname(path.join(xmlCacheDir, vehiclePath)), { recursive: true });
  await fs.writeFile(
    path.join(xmlCacheDir, vehiclePath),
    `
      <EntityClassDefinition.AEGS_Avenger_Titan __type="EntityClassDefinition" __ref="11111111-1111-1111-1111-111111111111" __path="${vehiclePath}">
        <Components>
          <VehicleComponentParams
            manufacturer="stale-manufacturer-guid"
            movementClass="Spaceship"
            vehicleName="@vehicle_NameAEGS_Avenger_Titan" />
        </Components>
      </EntityClassDefinition.AEGS_Avenger_Titan>
    `,
    'utf8',
  );
  const graph = makeGraph(vehiclePath);
  graph.records[0]?.referencedGuidAttributes?.push({
    attribute: 'manufacturer',
    value: '65a5d887-3b21-4046-a718-6912c0c7c3be',
  });

  const rows = await extractDataCoreVehicles({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(graph),
  });

  assert.equal(rows[0]?.manufacturerGuid, 'stale-manufacturer-guid');
  assert.equal(rows[0]?.manufacturerCode, '');
});

function makeGraph(vehiclePath: string): DataCoreRecordGraph {
  const manufacturerPath = 'libs/foundry/records/scitemmanufacturer/scitemmanufacturer.aegs.xml';
  return {
    source: 'datacore-record-graph',
    recordCount: 2,
    records: [
      {
        path: vehiclePath,
        ref: '11111111-1111-1111-1111-111111111111',
        rootTag: 'EntityClassDefinition.AEGS_Avenger_Titan',
        rootType: 'EntityClassDefinition',
        entityClass: 'AEGS_Avenger_Titan',
        localizationKeys: [
          { attribute: 'vehicleName', key: 'LOC_PLACEHOLDER' },
          { attribute: 'displayName', key: 'vehicle_NameAEGS_Avenger_Titan' },
          { attribute: 'vehicleDescription', key: 'LOC_PLACEHOLDER' },
          { attribute: 'displayDescription', key: 'vehicle_DescAEGS_Avenger_Titan' },
          { attribute: 'vehicleCareer', key: 'vehicle_focus_transporter' },
          { attribute: 'vehicleRole', key: 'vehicle_class_lightfreight' },
        ],
        referencedGuids: [
          'a623a5e1-27db-4e93-af6b-e54912b78e32',
          'cf4a74bf-eb2c-462a-9b78-f7f2724c31d2',
          'd86d770d-1fc4-4525-b3b0-4f670a8a5634',
          'ff99d78e-3a6a-4e4d-8b1c-59e87a005c11',
        ],
        referencedGuidAttributes: [
          { attribute: 'inventoryContainerParams', value: '' },
          { attribute: 'inventoryContainerParams', value: 'a623a5e1-27db-4e93-af6b-e54912b78e32' },
          { attribute: 'manufacturer', value: '' },
          { attribute: 'manufacturer', value: 'cf4a74bf-eb2c-462a-9b78-f7f2724c31d2' },
          { attribute: 'vehicleCareerRef', value: '' },
          { attribute: 'vehicleCareerRef', value: 'd86d770d-1fc4-4525-b3b0-4f670a8a5634' },
          { attribute: 'vehicleRoleRef', value: '' },
          { attribute: 'vehicleRoleRef', value: 'ff99d78e-3a6a-4e4d-8b1c-59e87a005c11' },
        ],
      },
      {
        path: manufacturerPath,
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
    ],
    indexes: {
      byRef: {
        '11111111-1111-1111-1111-111111111111': vehiclePath,
        'cf4a74bf-eb2c-462a-9b78-f7f2724c31d2': manufacturerPath,
      },
      byPath: {
        [vehiclePath]: 0,
        [manufacturerPath]: 1,
      },
      byRootType: {
        EntityClassDefinition: [vehiclePath],
        SCItemManufacturer: [manufacturerPath],
      },
      byEntityClass: {
        AEGS_Avenger_Titan: [vehiclePath],
        AEGS: [manufacturerPath],
      },
      byLocalizationKey: {
        vehicle_NameAEGS_Avenger_Titan: [vehiclePath],
        vehicle_DescAEGS_Avenger_Titan: [vehiclePath],
        manufacturer_NameAEGS: [manufacturerPath],
        manufacturer_DescAEGS: [manufacturerPath],
      },
      byReferencedGuid: {
        'cf4a74bf-eb2c-462a-9b78-f7f2724c31d2': [vehiclePath],
        'd86d770d-1fc4-4525-b3b0-4f670a8a5634': [vehiclePath],
        'ff99d78e-3a6a-4e4d-8b1c-59e87a005c11': [vehiclePath],
        'a623a5e1-27db-4e93-af6b-e54912b78e32': [vehiclePath],
      },
    },
  };
}
