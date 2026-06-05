import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { runMissileTitleTagUpdate } from './missile-title-tags';

async function makeTempWorkspace() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'missile-title-tags-'));
  const spviewerDir = path.join(dir, 'spviewer');
  const datacoreDir = path.join(dir, 'datacore');
  const mappingsDir = path.join(dir, 'mappings');
  const iniPath = path.join(dir, 'global.ini');
  await fs.mkdir(spviewerDir);
  await fs.mkdir(datacoreDir);
  await fs.mkdir(mappingsDir);

  await fs.writeFile(
    path.join(spviewerDir, 'missile.spviewer.csv'),
    ['Name,Tracking Signal', 'Arrow I Missile,Infrared', 'Spark I-G Missile,CrossSection'].join('\n'),
    'utf8',
  );
  await fs.writeFile(
    path.join(mappingsDir, 'missile.spviewer.json'),
    JSON.stringify({
      'Arrow I Missile': 'item_NameMISL_S01_IR_VNCL_Arrow',
      'Spark I-G Missile': 'item_NameGMISL_S01_CS_FSKI_Spark',
    }),
    'utf8',
  );
  await fs.writeFile(
    path.join(datacoreDir, 'missile.datacore.csv'),
    [
      'Entity Class,Name Key,Short Name Key,Tracking Signal',
      'gmisl_s01_cs_fski_spark,item_NameGMISL_S01_CS_FSKI_Spark,item_NameGMISL_S01_CS_FSKI_Spark_short,CrossSection',
      'gmisl_s01_em_behr_pioneer,item_NameGMISL_S01_EM_BEHR_Pioneer,item_NameGMISL_S01_EM_BEHR_Pioneer_short,Electromagnetic',
      'misl_s01_ir_vncl_arrow,item_NameMISL_S01_IR_VNCL_Arrow,item_NameMISL_S01_IR_VNCL_Arrow_short,Infrared',
    ].join('\n'),
    'utf8',
  );

  return { dir, spviewerDir, datacoreDir, iniPath };
}

describe('runMissileTitleTagUpdate', () => {
  it('keeps SPViewer mapped missile signal tags as legacy fallback', async () => {
    const { dir, spviewerDir, iniPath } = await makeTempWorkspace();
    try {
      await fs.writeFile(
        iniPath,
        [
          'item_NameMISL_S01_IR_VNCL_Arrow=Arrow I Missile',
          'item_NameMISL_S01_IR_VNCL_Arrow_short=Arrow I',
          'item_NameGMISL_S01_CS_FSKI_Spark=Spark I-G Missile',
        ].join('\n'),
        'utf8',
      );

      const result = await runMissileTitleTagUpdate({ iniPath, spviewerDir, repoRoot: dir, dryRun: false });
      const updated = await fs.readFile(iniPath, 'utf8');

      assert.equal(result.updatedCount, 3);
      assert.equal(result.matchedCount, 3);
      assert.match(updated, /item_NameMISL_S01_IR_VNCL_Arrow=\[IR\] Arrow I Missile/);
      assert.match(updated, /item_NameMISL_S01_IR_VNCL_Arrow_short=\[IR\] Arrow I/);
      assert.match(updated, /item_NameGMISL_S01_CS_FSKI_Spark=\[CS\] Spark I-G Missile/);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('adds missile signal tags from DataCore localization keys without SPViewer mapping', async () => {
    const { dir, datacoreDir, iniPath } = await makeTempWorkspace();
    try {
      await fs.writeFile(
        iniPath,
        [
          'item_NameGMISL_S01_CS_FSKI_Spark=Spark I-G Missile',
          'item_NameGMISL_S01_CS_FSKI_Spark_short=Spark I-G',
          'item_NameGMISL_S01_EM_BEHR_Pioneer=[IR] Pioneer I-G Missile',
          'item_name_unrelated=Spark I-G Missile',
        ].join('\n'),
        'utf8',
      );

      const result = await runMissileTitleTagUpdate({ iniPath, datacoreDir, dryRun: false });
      const updated = await fs.readFile(iniPath, 'utf8');

      assert.equal(result.updatedCount, 3);
      assert.equal(result.matchedCount, 3);
      assert.equal(result.scannedCount, 3);
      assert.match(updated, /item_NameGMISL_S01_CS_FSKI_Spark=\[CS\] Spark I-G Missile/);
      assert.match(updated, /item_NameGMISL_S01_CS_FSKI_Spark_short=\[CS\] Spark I-G/);
      assert.match(updated, /item_NameGMISL_S01_EM_BEHR_Pioneer=\[EM\] Pioneer I-G Missile/);
      assert.match(updated, /item_name_unrelated=Spark I-G Missile/);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
