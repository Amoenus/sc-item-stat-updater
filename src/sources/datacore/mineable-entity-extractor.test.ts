import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreMineableEntities } from './mineable-entity-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph } from './types';

const entityPath = 'libs/foundry/records/entities/mineable/asteroidctypemineablerock_aluminium.xml';
const nonMineablePath = 'libs/foundry/records/entities/mineable/test_miningdestroyable.xml';
const compositionPath = 'libs/foundry/records/mining/rockcompositionpresets/asteroid_ctype_aluminium.xml';
const globalParamsPath = 'libs/foundry/records/mining/globalparams/ship.xml';
const audioParamsPath = 'libs/foundry/records/mining/audioparams/ship.xml';
const densityClassPath = 'libs/foundry/records/entities/density/entity_density_class_mineable.xml';

test('extractDataCoreMineableEntities extracts first-party mineable entity params and resolved refs', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-mineable-entities-'));
  await writeXml(
    xmlCacheDir,
    entityPath,
    `
      <EntityClassDefinition.AsteroidCTypeMineableRock_Aluminium entityDensityClass="density-guid" __type="EntityClassDefinition" __ref="entity-guid" __path="${entityPath}">
        <Components>
          <MineableParams globalParams="global-guid" audioParams="audio-guid" composition="composition-guid" filledFactor="1" glowCurvePower="0.5" glowLerpSpeed="0.25" />
          <HarvestableParams allowAutoRespawning="1" />
        </Components>
      </EntityClassDefinition.AsteroidCTypeMineableRock_Aluminium>
    `,
  );
  await writeXml(
    xmlCacheDir,
    nonMineablePath,
    `<EntityClassDefinition.Test_MiningDestroyable __type="EntityClassDefinition" __ref="non-mineable-guid" __path="${nonMineablePath}" />`,
  );

  const rows = await extractDataCoreMineableEntities({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph()),
  });

  assert.deepEqual(rows, [
    {
      ref: 'entity-guid',
      path: entityPath,
      entityClass: 'AsteroidCTypeMineableRock_Aluminium',
      compositionGuid: 'composition-guid',
      compositionClass: 'Asteroid_CType_Aluminium',
      globalParamsGuid: 'global-guid',
      globalParamsClass: 'MiningGlobalParams_Ship',
      audioParamsGuid: 'audio-guid',
      audioParamsClass: 'MiningAudioParams_Ship',
      densityClassGuid: 'density-guid',
      densityClass: 'EntityDensityClass_Mineable',
      filledFactor: '1',
      glowCurvePower: '0.5',
      glowLerpSpeed: '0.25',
      allowAutoRespawning: '1',
    },
  ]);
});

async function writeXml(xmlCacheDir: string, recordPath: string, xml: string): Promise<void> {
  const xmlPath = path.join(xmlCacheDir, recordPath);
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(xmlPath, xml, 'utf8');
}

function makeGraph(): DataCoreRecordGraph {
  const records = [
    node(
      entityPath,
      'entity-guid',
      'EntityClassDefinition.AsteroidCTypeMineableRock_Aluminium',
      'EntityClassDefinition',
      'AsteroidCTypeMineableRock_Aluminium',
    ),
    node(
      nonMineablePath,
      'non-mineable-guid',
      'EntityClassDefinition.Test_MiningDestroyable',
      'EntityClassDefinition',
      'Test_MiningDestroyable',
    ),
    node(
      compositionPath,
      'composition-guid',
      'MineableComposition.Asteroid_CType_Aluminium',
      'MineableComposition',
      'Asteroid_CType_Aluminium',
    ),
    node(
      globalParamsPath,
      'global-guid',
      'MiningGlobalParams.MiningGlobalParams_Ship',
      'MiningGlobalParams',
      'MiningGlobalParams_Ship',
    ),
    node(
      audioParamsPath,
      'audio-guid',
      'MiningAudioParams.MiningAudioParams_Ship',
      'MiningAudioParams',
      'MiningAudioParams_Ship',
    ),
    node(
      densityClassPath,
      'density-guid',
      'EntityDensityClass.EntityDensityClass_Mineable',
      'EntityDensityClass',
      'EntityDensityClass_Mineable',
    ),
  ];

  return {
    source: 'datacore-record-graph',
    recordCount: records.length,
    records,
    indexes: {
      byRef: Object.fromEntries(records.map((record) => [record.ref, record.path])),
      byPath: Object.fromEntries(records.map((record, index) => [record.path, index])),
      byRootType: {
        EntityClassDefinition: [entityPath, nonMineablePath],
        MineableComposition: [compositionPath],
        MiningGlobalParams: [globalParamsPath],
        MiningAudioParams: [audioParamsPath],
        EntityDensityClass: [densityClassPath],
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
