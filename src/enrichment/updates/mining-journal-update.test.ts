import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runMiningJournalUpdate } from './mining-journal-update';

const JOURNAL_KEY = 'Journal_General_Mining_Compendium_Content';

test('runMiningJournalUpdate keeps SCMDB rarity rows and adds DataCore insights', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mining-journal-update-'));
  try {
    const scmdbDir = path.join(tempDir, 'scmdb');
    const datacoreDir = path.join(tempDir, 'datacore');
    const iniPath = path.join(tempDir, 'global.ini');
    await fs.mkdir(scmdbDir, { recursive: true });
    await fs.mkdir(datacoreDir, { recursive: true });

    await fs.writeFile(
      path.join(scmdbDir, 'mining-journal.csv'),
      ['Rarity Category,Element List,Insight Summary', 'Common,SCMDB Copper,', 'Rare,SCMDB Quantainium,'].join('\n'),
      'utf8',
    );
    await fs.writeFile(
      path.join(datacoreDir, 'mining-elements.datacore.csv'),
      [
        'Element Class,Element Name,Record GUID,Instability,Resistance,Optimal Window Thinness,Optimal Window Randomness,Explosion Multiplier',
        'Copper_Ore,Copper (Ore),copper-guid,20,-0.7,1,0.1,1',
        'Quantainium_Raw,Quantainium (Raw),quantainium-guid,900,0.9,1,0.2,12',
      ].join('\n'),
      'utf8',
    );
    await fs.writeFile(
      path.join(datacoreDir, 'mining-compositions.datacore.csv'),
      [
        'Mineable Element GUID,Mineable Element Class,Probability',
        'copper-guid,Copper_Ore,1',
        'quantainium-guid,Quantainium_Raw,0.1',
      ].join('\n'),
      'utf8',
    );
    await fs.writeFile(
      path.join(datacoreDir, 'mining-quality-distributions.datacore.csv'),
      ['Distribution Type,Mineable Family,Min Quality,Max Quality', 'default,shipmineables,501,1000'].join('\n'),
      'utf8',
    );
    await fs.writeFile(iniPath, `${JOURNAL_KEY}=Mining intro.\\n\\n** Common **\\nOld`, 'utf8');

    const result = await runMiningJournalUpdate({ iniPath, missionCsvDir: scmdbDir, datacoreDir, dryRun: false });
    const updated = await fs.readFile(iniPath, 'utf8');

    assert.equal(result?.updatedCount, 1);
    assert.match(updated, /\*\* Mining Insights \*\*/);
    assert.match(updated, /Hardest: Quantainium \(Raw\)/);
    assert.match(updated, /Quality Floors: shipmineables: 50\.1-100\.0%/);
    assert.match(updated, /\*\* Common \*\*\\nSCMDB Copper/);
    assert.match(updated, /\*\* Rare \*\*\\nSCMDB Quantainium/);
    assert.doesNotMatch(updated, /\*\* Legendary \*\*\\nQuantainium \(Raw\)/);
    assert.doesNotMatch(updated, /\*\* Common \*\*\\nCopper \(Ore\)/);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
