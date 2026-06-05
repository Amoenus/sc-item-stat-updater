import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildDataCoreRecordGraph } from './record-graph';

test('buildDataCoreRecordGraph indexes DataForge XML records by graph keys', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-record-graph-'));
  const vehiclePath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'entities', 'spaceships', 'ship.xml');
  const manufacturerPath = path.join(xmlCacheDir, 'libs', 'foundry', 'records', 'scitemmanufacturer', 'aegs.xml');
  await fs.mkdir(path.dirname(vehiclePath), { recursive: true });
  await fs.mkdir(path.dirname(manufacturerPath), { recursive: true });

  await fs.writeFile(
    vehiclePath,
    `
      <EntityClassDefinition.AEGS_Avenger __ref="11111111-1111-1111-1111-111111111111" __type="EntityClassDefinition" __path="libs/foundry/records/entities/spaceships/aegs_avenger.xml" vehicleName="@vehicle_Name_AEGS_Avenger">
        <Vehicle vehicleDescription="vehicle_Desc_AEGS_Avenger" />
        <Fallback Name="Raw entity name is not a localization reference" />
        <Reference value="22222222-2222-2222-2222-222222222222" />
        <Reference value="22222222-2222-2222-2222-222222222222" />
      </EntityClassDefinition.AEGS_Avenger>
    `,
  );
  await fs.writeFile(
    manufacturerPath,
    `
      <Manufacturer __ref="22222222-2222-2222-2222-222222222222" __type="Manufacturer" __path="libs/foundry/records/scitemmanufacturer/aegs.xml" Name="@manufacturer_Name_AEGS">
        <Details Description="@manufacturer_Desc_AEGS" />
      </Manufacturer>
    `,
  );

  const graph = await buildDataCoreRecordGraph({ xmlCacheDir });

  assert.equal(graph.source, 'datacore-record-graph');
  assert.equal(graph.recordCount, 2);
  assert.equal(
    graph.indexes.byRef['11111111-1111-1111-1111-111111111111'],
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  );
  assert.equal(graph.indexes.byPath['libs/foundry/records/entities/spaceships/aegs_avenger.xml'], 0);
  assert.deepEqual(graph.indexes.byRootType.EntityClassDefinition, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.indexes.byEntityClass.AEGS_Avenger, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.deepEqual(graph.indexes.byLocalizationKey.vehicle_Name_AEGS_Avenger, [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
  assert.equal(graph.indexes.byLocalizationKey['Raw entity name is not a localization reference'], undefined);
  assert.deepEqual(graph.indexes.byLocalizationKey.manufacturer_Desc_AEGS, [
    'libs/foundry/records/scitemmanufacturer/aegs.xml',
  ]);
  assert.deepEqual(graph.indexes.byReferencedGuid['22222222-2222-2222-2222-222222222222'], [
    'libs/foundry/records/entities/spaceships/aegs_avenger.xml',
  ]);
});
