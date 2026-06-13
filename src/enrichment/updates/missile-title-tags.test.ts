import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { runMissileTitleTagUpdate } from './missile-title-tags';

async function makeTempWorkspace() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'missile-title-tags-'));
  const datacoreDir = path.join(dir, 'datacore');
  const iniPath = path.join(dir, 'global.ini');
  await fs.mkdir(datacoreDir);

  await fs.writeFile(
    path.join(datacoreDir, 'missile.datacore.csv'),
    [
      'Entity Class,Name Key,Short Name Key,Tracking Signal',
      'gmisl_s01_cs_fski_spark,item_NameStale_Spark,item_NameStale_Spark_short,CrossSection',
      'gmisl_s01_em_behr_pioneer,item_NameGMISL_S01_EM_BEHR_Pioneer,item_NameGMISL_S01_EM_BEHR_Pioneer_short,Electromagnetic',
      'misl_s01_ir_vncl_arrow,item_NameMISL_S01_IR_VNCL_Arrow,item_NameMISL_S01_IR_VNCL_Arrow_short,Infrared',
      'missile_custom,item_NameCustom_Rocket,item_NameCustom_Rocket_short,Infrared',
    ].join('\n'),
    'utf8',
  );
  await fs.writeFile(
    path.join(datacoreDir, 'record-graph.json'),
    JSON.stringify({
      source: 'datacore-record-graph',
      recordCount: 1,
      records: [
        {
          path: 'ships/weapons/missiles/gmisl_s01_cs_fski_spark.xml',
          ref: 'spark-ref',
          rootTag: 'EntityClassDefinition.gmisl_s01_cs_fski_spark',
          rootType: 'EntityClassDefinition',
          entityClass: 'gmisl_s01_cs_fski_spark',
          localizationKeys: [
            { attribute: 'Name', key: 'item_NameGMISL_S01_CS_FSKI_Spark' },
            { attribute: 'ShortName', key: 'item_NameGMISL_S01_CS_FSKI_Spark_short' },
          ],
          referencedGuids: [],
        },
      ],
      indexes: {
        byRef: {},
        byPath: {},
        byRootType: {},
        byEntityClass: {},
        byLocalizationKey: {},
        byReferencedGuid: {},
      },
    }),
    'utf8',
  );

  return { dir, datacoreDir, iniPath };
}

describe('runMissileTitleTagUpdate', () => {
  it('adds missile signal tags from DataCore localization keys', async () => {
    const { dir, datacoreDir, iniPath } = await makeTempWorkspace();
    try {
      await fs.writeFile(
        iniPath,
        [
          'item_NameGMISL_S01_CS_FSKI_Spark=Spark I-G Missile',
          'item_NameGMISL_S01_CS_FSKI_Spark_short=Spark I-G',
          'item_NameGMISL_S01_EM_BEHR_Pioneer=[IR] Pioneer I-G Missile',
          'item_NameCustom_Rocket=Patternless Missile',
          'item_NameCustom_Rocket_short=Patternless',
          'item_name_unrelated=Spark I-G Missile',
        ].join('\n'),
        'utf8',
      );

      const result = await runMissileTitleTagUpdate({ iniPath, datacoreDir, dryRun: false });
      const updated = await fs.readFile(iniPath, 'utf8');

      assert.equal(result.updatedCount, 5);
      assert.equal(result.matchedCount, 5);
      assert.equal(result.scannedCount, 6);
      assert.match(updated, /item_NameGMISL_S01_CS_FSKI_Spark=\[CS\] Spark I-G Missile/);
      assert.match(updated, /item_NameGMISL_S01_CS_FSKI_Spark_short=\[CS\] Spark I-G/);
      assert.match(updated, /item_NameGMISL_S01_EM_BEHR_Pioneer=\[EM\] Pioneer I-G Missile/);
      assert.match(updated, /item_NameCustom_Rocket=\[IR\] Patternless Missile/);
      assert.match(updated, /item_NameCustom_Rocket_short=\[IR\] Patternless/);
      assert.match(updated, /item_name_unrelated=Spark I-G Missile/);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
