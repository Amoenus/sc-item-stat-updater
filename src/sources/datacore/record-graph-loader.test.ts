import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createDataCoreRecordGraphLookup,
  loadDataCoreRecordGraph,
  resolveDataCoreRecordGraphPath,
} from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

const vehiclePath = 'libs/foundry/records/entities/spaceships/aegs_avenger.xml';
const manufacturerPath = 'libs/foundry/records/scitemmanufacturer/scitemmanufacturer.aegs.xml';

test('loadDataCoreRecordGraph loads a version graph and resolves records by indexed fields', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-loader-'));
  const version = '4.8.0.11875683-live';
  const versionDir = path.join(repoRoot, 'csv', 'datacore', version);
  await fs.mkdir(versionDir, { recursive: true });
  await fs.writeFile(path.join(versionDir, 'record-graph.json'), `${JSON.stringify(makeGraph())}\n`, 'utf8');

  const graph = await loadDataCoreRecordGraph({ repoRoot, version });

  assert.equal(resolveDataCoreRecordGraphPath({ repoRoot, version }), path.join(versionDir, 'record-graph.json'));
  assert.equal(graph.getByRef('11111111-1111-1111-1111-111111111111')?.path, vehiclePath);
  assert.equal(graph.getByPath(vehiclePath)?.entityClass, 'AEGS_Avenger');
  assert.deepEqual(
    graph.getByRootType('SCItemManufacturer').map((record) => record.path),
    [manufacturerPath],
  );
  assert.deepEqual(
    graph.getByEntityClass('AEGS').map((record) => record.path),
    [manufacturerPath],
  );
  assert.deepEqual(
    graph.getByLocalizationKey('@manufacturer_NameAEGS').map((record) => record.path),
    [manufacturerPath],
  );
  assert.deepEqual(
    graph.getByReferencedGuid('22222222-2222-2222-2222-222222222222').map((record) => record.path),
    [vehiclePath],
  );
  assert.deepEqual(
    graph.getByPathPrefix('libs\\foundry\\records\\scitemmanufacturer').map((record) => record.path),
    [manufacturerPath],
  );
});

test('createDataCoreRecordGraphLookup tolerates path separator differences', () => {
  const graph = createDataCoreRecordGraphLookup(makeGraph());

  assert.equal(
    graph.getByPath('libs\\foundry\\records\\entities\\spaceships\\aegs_avenger.xml')?.ref,
    '11111111-1111-1111-1111-111111111111',
  );
});

function makeGraph(): DataCoreRecordGraph {
  return {
    source: 'datacore-record-graph',
    recordCount: 2,
    records: [
      {
        path: vehiclePath,
        ref: '11111111-1111-1111-1111-111111111111',
        rootTag: 'EntityClassDefinition.AEGS_Avenger',
        rootType: 'EntityClassDefinition',
        entityClass: 'AEGS_Avenger',
        localizationKeys: [{ attribute: 'vehicleName', key: 'vehicle_Name_AEGS_Avenger' }],
        referencedGuids: ['22222222-2222-2222-2222-222222222222'],
      },
      {
        path: manufacturerPath,
        ref: '22222222-2222-2222-2222-222222222222',
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
        '22222222-2222-2222-2222-222222222222': manufacturerPath,
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
        AEGS_Avenger: [vehiclePath],
        AEGS: [manufacturerPath],
      },
      byLocalizationKey: {
        vehicle_Name_AEGS_Avenger: [vehiclePath],
        manufacturer_NameAEGS: [manufacturerPath],
        manufacturer_DescAEGS: [manufacturerPath],
      },
      byReferencedGuid: {
        '22222222-2222-2222-2222-222222222222': [vehiclePath],
      },
    },
  };
}
