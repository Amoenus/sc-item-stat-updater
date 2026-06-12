import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runAdagioLocationTagUpdate } from '../../enrichment/updates/adagio-location-tags';
import { runComponentTitleUpdate } from '../../enrichment/updates/component-titles';
import missionDescriptionsConfig from '../../items/missions/datacore-descriptions';
import missionTitlesConfig from '../../items/missions/datacore-titles';
import { buildJournalValue } from '../../items/missions/mining-journal';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'generated-string-snapshot-'));
}

function stripBom(text: string): string {
  return text.codePointAt(0) === 0xfeff ? text.slice(1) : text;
}

test('snapshot: SCMDB mission description preserves metadata ordering and whitespace', () => {
  assert.ok(missionDescriptionsConfig.buildValue);
  const result = missionDescriptionsConfig.buildValue(
    {
      Description: 'Deliver the package to ~mission(Location|Address).',
      ContractIntel: String.raw`Reward: 12,000 aUEC\nTime Limit: 18 min`,
      Cooldown: '45m',
      Note: 'Avoid collateral damage.',
      RewardList: String.raw`[BP Reward]\n\nSchematic: Frostbite Cooler`,
      ItemRewardList: 'Utility Pack',
    },
    '',
    '',
    'mission_description',
  );

  assert.equal(
    result,
    'Deliver the package to ~mission(Location|Address).\\n\\n** Contract Intel **\\nTime Limit: 18 min\\n\\nAvoid collateral damage.\\n\\n[BP Reward]\\n\\nSchematic: Frostbite Cooler\\n\\n[Item Reward]\\n\\nUtility Pack',
  );
});

test('snapshot: mining journal keeps insight and rarity sections in stable order', () => {
  const result = buildJournalValue(
    [
      {
        'Rarity Category': 'Common',
        'Element List': 'Quartz\nCorundum',
        'Insight Summary': 'Refinery bonuses favor volatile ores today.',
      },
      {
        'Rarity Category': 'Legendary',
        'Element List': 'Quantanium',
      },
      {
        'Rarity Category': 'Rare',
        'Element List': 'Bexalite',
      },
    ],
    String.raw`Mining overview intro.\n\n** Common **\nOld order`,
  );

  assert.equal(
    result,
    String.raw`Mining overview intro.\n\n** Mining Insights **\nRefinery bonuses favor volatile ores today.\n\n** Legendary **\nQuantanium\n\n** Rare **\nBexalite\n\n** Common **\nQuartz\nCorundum`,
  );
});

test('snapshot: component title tags apply stable mining prefixes to variant families', async () => {
  const tempDir = await makeTempDir();
  try {
    const datacoreDir = path.join(tempDir, 'datacore');
    const iniPath = path.join(tempDir, 'global.ini');
    await fs.mkdir(datacoreDir, { recursive: true });
    await fs.writeFile(
      path.join(datacoreDir, 'miningmodifier.datacore.csv'),
      [
        'Entity Class,Name Key,Description Key,Manufacturer,Size,Grade,Class',
        'helix_mining_head,item_name_mining_head_helix,item_desc_mining_head_helix,GMNI,1,A,Industrial',
      ].join('\n'),
      'utf8',
    );
    await fs.writeFile(
      iniPath,
      ['item_name_mining_head_helix=Helix Mining Head', 'item_name_mining_head_helix_red=Helix Mining Head Red'].join(
        '\n',
      ),
      'utf8',
    );

    await runComponentTitleUpdate({ iniPath, datacoreDir, dryRun: false });

    assert.equal(
      stripBom(await fs.readFile(iniPath, 'utf8')),
      [
        'item_name_mining_head_helix=Ind/1/A Helix Mining Head',
        'item_name_mining_head_helix_red=Ind/1/A Helix Mining Head Red',
      ].join('\n'),
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('snapshot: mission title generated tags retain stable ordering', () => {
  assert.ok(missionTitlesConfig.buildValue);
  const result = missionTitlesConfig.buildValue(
    {
      Description: 'Recover Prototype',
      TitleNote: ' <EM4>[Intro]</EM4> <EM4>[BP Chain]</EM4>',
    },
    '',
    'Recover Prototype <EM4>[BP]</EM4>  ',
    'mission_title',
  );

  assert.equal(result, 'Recover Prototype <EM4>[Intro]</EM4> <EM4>[BP Chain]</EM4>');
});

test('snapshot: Adagio location labels wrap bare runtime location tags once', async () => {
  const tempDir = await makeTempDir();
  try {
    const iniPath = path.join(tempDir, 'global.ini');
    await fs.writeFile(
      iniPath,
      [
        'Adagio_BasicSalvage_Desc_01=Survey wreckage near ~mission(location) before extraction.',
        'Adagio_LocateSalvage_Desc_01=Already tagged near <EM4>~mission(location)</EM4>.',
      ].join('\n'),
      'utf8',
    );

    await runAdagioLocationTagUpdate({ iniPath, dryRun: false });

    assert.equal(
      stripBom(await fs.readFile(iniPath, 'utf8')),
      [
        'Adagio_BasicSalvage_Desc_01=Survey wreckage near <EM4>~mission(location)</EM4> before extraction.',
        'Adagio_LocateSalvage_Desc_01=Already tagged near <EM4>~mission(location)</EM4>.',
      ].join('\n'),
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
