import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { runFpsTitleTagUpdate } from './fps-title-tags';

async function makeTempWorkspace() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fps-title-tags-'));
  const spviewerDir = path.join(dir, 'spviewer');
  const iniPath = path.join(dir, 'global.ini');
  await fs.mkdir(spviewerDir);

  await fs.writeFile(
    path.join(spviewerDir, 'weaponpersonal.spviewer.csv'),
    [
      'Name,Size,Type,Damage DPS Physical,Damage DPS Energy,Damage DPS Distortion,Damage DPS Stun',
      'Gallant Rifle,2,Energy Rifle,0,42,0,0',
      'P4-AR Rifle,1,Ballistic Rifle,21,0,0,0',
      'Greycat Stunner,0,Utility,0,0,1,5',
    ].join('\n'),
  );
  await fs.writeFile(
    path.join(spviewerDir, 'weaponattachment.spviewer.csv'),
    ['Name,Size,Slot,Type', 'Beacon Light,1,,Flashlight'].join('\n'),
  );

  return { dir, spviewerDir, iniPath };
}

describe('runFpsTitleTagUpdate', () => {
  it('adds FPS tags to matched weapons, attachments, and known variants', async () => {
    const { dir, spviewerDir, iniPath } = await makeTempWorkspace();
    try {
      await fs.writeFile(
        iniPath,
        [
          'item_name_gallant_rifle=Gallant Rifle',
          'item_name_gallant_rifle_red=Gallant Rifle Red',
          'item_name_gallant_rifle_short=Gallant Rifle Short',
          'item_name_beacon_attachment=Beacon Light',
          'item_name_unrelated=Beacon Light',
        ].join('\n'),
      );

      const result = await runFpsTitleTagUpdate({ iniPath, spviewerDir, dryRun: false });
      const updated = await fs.readFile(iniPath, 'utf-8');

      assert.strictEqual(result.updatedCount, 3);
      assert.strictEqual(result.matchedCount, 2);
      assert.strictEqual(result.scannedCount, 5);
      assert.match(updated, /item_name_gallant_rifle=\[S2\|RFL\|ENG\] Gallant Rifle/);
      assert.match(updated, /item_name_gallant_rifle_red=\[S2\|RFL\|ENG\] Gallant Rifle Red/);
      assert.match(updated, /item_name_gallant_rifle_short=Gallant Rifle Short/);
      assert.match(updated, /item_name_beacon_attachment=\[S1\|FLS\] Beacon Light/);
      assert.match(updated, /item_name_unrelated=Beacon Light/);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('reports matches without writing when dryRun is enabled', async () => {
    const { dir, spviewerDir, iniPath } = await makeTempWorkspace();
    try {
      const original = 'item_name_p4_rifle=P4-AR Rifle';
      await fs.writeFile(iniPath, original);

      const result = await runFpsTitleTagUpdate({ iniPath, spviewerDir, dryRun: true });
      const unchanged = await fs.readFile(iniPath, 'utf-8');

      assert.strictEqual(result.updatedCount, 1);
      assert.strictEqual(result.matchedCount, 1);
      assert.strictEqual(result.scannedCount, 1);
      assert.strictEqual(unchanged, original);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('preserves distortion-over-stun damage priority', async () => {
    const { dir, spviewerDir, iniPath } = await makeTempWorkspace();
    try {
      await fs.writeFile(iniPath, 'item_name_greycat_pistol=Greycat Stunner');

      const result = await runFpsTitleTagUpdate({ iniPath, spviewerDir, dryRun: false });
      const updated = await fs.readFile(iniPath, 'utf-8');

      assert.strictEqual(result.updatedCount, 1);
      assert.match(updated, /item_name_greycat_pistol=\[S0\|WPN\|DIS\] Greycat Stunner/);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
