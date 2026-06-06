import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreMiningRockSignatures } from './mining-rock-signature-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

const asteroidPath = 'libs/foundry/records/entities/mineable/mineablerock_asteroiduncommon_agricium.xml';
const surfacePath = 'libs/foundry/records/entities/mineable/mineablerock_surfaceuncommon_agricium.xml';
const fpsPath = 'libs/foundry/records/entities/mineable/mineablerock_fps_carinite_pure_small.xml';
const groundPath = 'libs/foundry/records/entities/mineable/mineablerock_groundvehicle_carinite.xml';
const sizedAsteroidPath =
  'libs/foundry/records/entities/mineable/mineablerock_asteroidlegendary_savrilium_rcd_small.xml';
const testPath = 'libs/foundry/records/entities/mineable/mineablerock_test_aluminium.xml';

const SIGNATURE_XML_AGRICIUM = signatureXml(
  'MineableRock_AsteroidUncommon_Agricium',
  asteroidPath,
  'aee32aa3-ff94-4a67-9f1d-1d33f65efd01',
  3885,
);
const SIGNATURE_XML_SURFACE_AGRICIUM = signatureXml(
  'MineableRock_SurfaceUncommon_Agricium',
  surfacePath,
  'aee32aa3-ff94-4a67-9f1d-1d33f65efd02',
  3885,
);
const SIGNATURE_XML_FPS = signatureXml(
  'MineableRock_FPS_Carinite_Pure_Small',
  fpsPath,
  'aee32aa3-ff94-4a67-9f1d-1d33f65efd03',
  3000,
);
const SIGNATURE_XML_GROUND = signatureXml(
  'MineableRock_GroundVehicle_Carinite',
  groundPath,
  'aee32aa3-ff94-4a67-9f1d-1d33f65efd04',
  4000,
);
const SIGNATURE_XML_SIZED = signatureXml(
  'MineableRock_AsteroidLegendary_Savrilium_RCD_small',
  sizedAsteroidPath,
  'aee32aa3-ff94-4a67-9f1d-1d33f65efd05',
  4200,
);
const SIGNATURE_XML_TEST = signatureXml(
  'MineableRock_Test_Aluminium',
  testPath,
  'aee32aa3-ff94-4a67-9f1d-1d33f65efd06',
  4000,
);

test('extractDataCoreMiningRockSignatures classifies variants and reads slot-5 signature', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-mining-rock-sigs-'));
  await Promise.all([
    writeXml(xmlCacheDir, asteroidPath, SIGNATURE_XML_AGRICIUM),
    writeXml(xmlCacheDir, surfacePath, SIGNATURE_XML_SURFACE_AGRICIUM),
    writeXml(xmlCacheDir, fpsPath, SIGNATURE_XML_FPS),
    writeXml(xmlCacheDir, groundPath, SIGNATURE_XML_GROUND),
    writeXml(xmlCacheDir, sizedAsteroidPath, SIGNATURE_XML_SIZED),
    writeXml(xmlCacheDir, testPath, SIGNATURE_XML_TEST),
  ]);

  const rows = await extractDataCoreMiningRockSignatures({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph()),
  });

  assert.equal(rows.length, 5, 'test variant should be filtered out');

  const asteroid = rows.find((row) => row.path === asteroidPath);
  assert.ok(asteroid);
  assert.equal(asteroid.variantFamily, 'asteroid');
  assert.equal(asteroid.rarity, 'uncommon');
  assert.equal(asteroid.elementToken, 'Agricium');
  assert.equal(asteroid.scanSignature, '3885');

  const surface = rows.find((row) => row.path === surfacePath);
  assert.ok(surface);
  assert.equal(surface.variantFamily, 'surface');
  assert.equal(surface.rarity, 'uncommon');
  assert.equal(surface.elementToken, 'Agricium');
  assert.equal(surface.scanSignature, '3885');

  const fps = rows.find((row) => row.path === fpsPath);
  assert.ok(fps);
  assert.equal(fps.variantFamily, 'fps');
  assert.equal(fps.rarity, '');
  assert.equal(fps.elementToken, 'Carinite_Pure', 'size suffix _Small should be stripped but Pure preserved');
  assert.equal(fps.scanSignature, '3000');

  const ground = rows.find((row) => row.path === groundPath);
  assert.ok(ground);
  assert.equal(ground.variantFamily, 'groundvehicle');
  assert.equal(ground.elementToken, 'Carinite');
  assert.equal(ground.scanSignature, '4000');

  const sized = rows.find((row) => row.path === sizedAsteroidPath);
  assert.ok(sized);
  assert.equal(sized.variantFamily, 'asteroid');
  assert.equal(sized.rarity, 'legendary');
  assert.equal(sized.elementToken, 'Savrilium', 'RCD_small should be stripped to bare element token');
  assert.equal(sized.scanSignature, '4200');
});

function signatureXml(entityClass: string, recordPath: string, ref: string, signatureValue: number): string {
  return `<EntityClassDefinition.${entityClass} __type="EntityClassDefinition" __ref="${ref}" __path="${recordPath}">
  <Components>
    <SSCSignatureSystemParams>
      <radarProperties>
        <SSCRadarContactProperites>
          <baseSignatureParams>
            <SSCSignatureSystemBaseSignatureParams>
              <signatures>
                <Single value="999" />
                <Single value="0" />
                <Single value="0" />
                <Single value="0" />
                <Single value="${signatureValue}" />
                <Single value="0" />
                <Single value="0" />
                <Single value="0" />
              </signatures>
            </SSCSignatureSystemBaseSignatureParams>
          </baseSignatureParams>
        </SSCRadarContactProperites>
      </radarProperties>
    </SSCSignatureSystemParams>
  </Components>
</EntityClassDefinition.${entityClass}>`;
}

async function writeXml(xmlCacheDir: string, recordPath: string, xml: string): Promise<void> {
  const xmlPath = path.join(xmlCacheDir, recordPath);
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(xmlPath, xml, 'utf8');
}

function makeGraph(): DataCoreRecordGraph {
  return {
    source: 'datacore-record-graph',
    recordCount: 6,
    records: [
      node(
        asteroidPath,
        'aee32aa3-ff94-4a67-9f1d-1d33f65efd01',
        'EntityClassDefinition.MineableRock_AsteroidUncommon_Agricium',
        'EntityClassDefinition',
        'MineableRock_AsteroidUncommon_Agricium',
      ),
      node(
        surfacePath,
        'aee32aa3-ff94-4a67-9f1d-1d33f65efd02',
        'EntityClassDefinition.MineableRock_SurfaceUncommon_Agricium',
        'EntityClassDefinition',
        'MineableRock_SurfaceUncommon_Agricium',
      ),
      node(
        fpsPath,
        'aee32aa3-ff94-4a67-9f1d-1d33f65efd03',
        'EntityClassDefinition.MineableRock_FPS_Carinite_Pure_Small',
        'EntityClassDefinition',
        'MineableRock_FPS_Carinite_Pure_Small',
      ),
      node(
        groundPath,
        'aee32aa3-ff94-4a67-9f1d-1d33f65efd04',
        'EntityClassDefinition.MineableRock_GroundVehicle_Carinite',
        'EntityClassDefinition',
        'MineableRock_GroundVehicle_Carinite',
      ),
      node(
        sizedAsteroidPath,
        'aee32aa3-ff94-4a67-9f1d-1d33f65efd05',
        'EntityClassDefinition.MineableRock_AsteroidLegendary_Savrilium_RCD_small',
        'EntityClassDefinition',
        'MineableRock_AsteroidLegendary_Savrilium_RCD_small',
      ),
      node(
        testPath,
        'aee32aa3-ff94-4a67-9f1d-1d33f65efd06',
        'EntityClassDefinition.MineableRock_Test_Aluminium',
        'EntityClassDefinition',
        'MineableRock_Test_Aluminium',
      ),
    ],
    indexes: {
      byRef: {},
      byPath: {
        [asteroidPath]: 0,
        [surfacePath]: 1,
        [fpsPath]: 2,
        [groundPath]: 3,
        [sizedAsteroidPath]: 4,
        [testPath]: 5,
      },
      byRootType: {
        EntityClassDefinition: [asteroidPath, surfacePath, fpsPath, groundPath, sizedAsteroidPath, testPath],
      },
      byEntityClass: {},
      byLocalizationKey: {},
      byReferencedGuid: {},
    },
  };
}

function node(path: string, ref: string, rootTag: string, rootType: string, entityClass: string) {
  return {
    path,
    ref,
    rootTag,
    rootType,
    entityClass,
    localizationKeys: [],
    referencedGuids: [],
  };
}
