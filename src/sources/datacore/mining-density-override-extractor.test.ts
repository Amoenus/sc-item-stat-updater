import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractDataCoreMiningDensityOverrides } from './mining-density-override-extractor';
import { createDataCoreRecordGraphLookup } from './record-graph-loader';
import type { DataCoreRecordGraph, DataCoreRecordNode } from './types';

const miningOverridePath = 'libs/foundry/records/densityclasses/overrides/stanton_hightechminingoutpost.xml';
const genericOverridePath = 'libs/foundry/records/densityclasses/overrides/generic_dungeon_default.xml';
const spaceshipDensityPath = 'libs/foundry/records/densityclasses/spaceshipdensityclass.xml';

test('extractDataCoreMiningDensityOverrides extracts mining lifetime override rows and resolves density classes', async () => {
  const xmlCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacore-mining-density-overrides-'));
  await writeXml(
    xmlCacheDir,
    miningOverridePath,
    `
      <SEntityDensityClassOverridesRecord.Stanton_HighTechMiningOutpost __type="SEntityDensityClassOverridesRecord" __ref="ad7b50ff-f32b-4156-a56e-f0ddfc48f76d" __path="${miningOverridePath}">
        <overrides>
          <densityClassLifetimeOverrides>
            <SDensityClassLifetimeOverrideEntry densityClass="99999999-9999-9999-9999-999999999998">
              <lifetimeOverride>
                <TimeValue_Partitioned days="0" hours="20" minutes="30" seconds="5" />
              </lifetimeOverride>
            </SDensityClassLifetimeOverrideEntry>
          </densityClassLifetimeOverrides>
        </overrides>
      </SEntityDensityClassOverridesRecord.Stanton_HighTechMiningOutpost>
    `,
  );
  await writeXml(
    xmlCacheDir,
    genericOverridePath,
    `
      <SEntityDensityClassOverridesRecord.Generic_Dungeon_Default __type="SEntityDensityClassOverridesRecord" __ref="11111111-1111-1111-1111-111111111111" __path="${genericOverridePath}">
        <overrides>
          <densityClassLifetimeOverrides>
            <SDensityClassLifetimeOverrideEntry densityClass="b6cc39fd-7c14-4568-b261-197834e51116">
              <lifetimeOverride>
                <TimeValue_Partitioned days="1" hours="0" minutes="0" seconds="0" />
              </lifetimeOverride>
            </SDensityClassLifetimeOverrideEntry>
          </densityClassLifetimeOverrides>
        </overrides>
      </SEntityDensityClassOverridesRecord.Generic_Dungeon_Default>
    `,
  );

  const rows = await extractDataCoreMiningDensityOverrides({
    xmlCacheDir,
    graph: createDataCoreRecordGraphLookup(makeGraph()),
  });

  assert.deepEqual(rows, [
    {
      ref: 'ad7b50ff-f32b-4156-a56e-f0ddfc48f76d',
      path: miningOverridePath,
      overrideClass: 'Stanton_HighTechMiningOutpost',
      densityClassGuid: 'b6cc39fd-7c14-4568-b261-197834e51116',
      densityClass: 'SpaceShipDensityClass',
      densityClassPath: spaceshipDensityPath,
      lifetimeDays: '0',
      lifetimeHours: '20',
      lifetimeMinutes: '30',
      lifetimeSeconds: '5',
      lifetimeTotalSeconds: '73805',
    },
  ]);
});

async function writeXml(xmlCacheDir: string, recordPath: string, xml: string): Promise<void> {
  const xmlPath = path.join(xmlCacheDir, recordPath);
  await fs.mkdir(path.dirname(xmlPath), { recursive: true });
  await fs.writeFile(xmlPath, xml, 'utf8');
}

function makeGraph(): DataCoreRecordGraph {
  const records: DataCoreRecordNode[] = [
    node(
      miningOverridePath,
      'ad7b50ff-f32b-4156-a56e-f0ddfc48f76d',
      'SEntityDensityClassOverridesRecord',
      'Stanton_HighTechMiningOutpost',
      [{ attribute: 'densityClass', value: 'b6cc39fd-7c14-4568-b261-197834e51116' }],
    ),
    node(
      genericOverridePath,
      '11111111-1111-1111-1111-111111111111',
      'SEntityDensityClassOverridesRecord',
      'Generic_Dungeon_Default',
    ),
    node(spaceshipDensityPath, 'b6cc39fd-7c14-4568-b261-197834e51116', 'SEntityDensityClass', 'SpaceShipDensityClass'),
  ];

  return {
    source: 'datacore-record-graph',
    recordCount: records.length,
    records,
    indexes: {
      byRef: Object.fromEntries(records.map((record) => [record.ref, record.path])),
      byPath: Object.fromEntries(records.map((record, index) => [record.path, index])),
      byRootType: {
        SEntityDensityClassOverridesRecord: [miningOverridePath, genericOverridePath],
        SEntityDensityClass: [spaceshipDensityPath],
      },
      byEntityClass: {},
      byLocalizationKey: {},
      byReferencedGuid: {},
    },
  };
}

function node(
  pathValue: string,
  ref: string,
  rootType: string,
  entityClass: string,
  referencedGuidAttributes: NonNullable<DataCoreRecordNode['referencedGuidAttributes']> = [],
): DataCoreRecordNode {
  return {
    path: pathValue,
    ref,
    rootTag: `${rootType}.${entityClass}`,
    rootType,
    entityClass,
    localizationKeys: [],
    referencedGuids: referencedGuidAttributes.map((reference) => reference.value),
    referencedGuidAttributes,
  };
}
