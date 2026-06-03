import assert from 'node:assert';
import { describe, it } from 'node:test';
import { buildMissionRows, collectBlueprintChainData } from './mission-parser';

describe('SCMDB mission parser enrichment', () => {
  it('uses intro title tags without stacking blueprint title tags', () => {
    const contract = {
      id: 'intro-bp',
      titleKey: '@mission_intro_title',
      title: 'Intro Mission',
      descriptionLocKey: '@mission_intro_desc',
      descriptionKey: '@mission_intro_desc',
      description: 'Meet the client.',
      isIntro: true,
      blueprintRewards: [{ blueprintPool: 'pool-1', chance: 1, poolName: 'Pool', trigger: 'complete' }],
      hasPersonalCooldown: false,
      personalCooldownTime: 0,
      timeToComplete: 0,
      rewardUEC: null,
      buyIn: null,
      prerequisites: {},
      haulingOrders: null,
      shipEncounters: null,
      minStanding: null,
    };
    const rows = buildMissionRows([contract as never], collectBlueprintChainData([contract as never]), {
      'pool-1': { name: 'Pool', source: 'mission', blueprints: [{ weight: 1, name: 'Blueprint' }] },
    } as never);

    assert.strictEqual(rows[0].TitleNote, ' <EM4>[Intro]</EM4>');
  });

  it('does not mark contracts with intro prerequisites as intro missions', () => {
    const contract = {
      id: 'requires-intro-bp',
      titleKey: '@mission_requires_intro_title',
      title: 'Unlocked Mission',
      descriptionLocKey: '@mission_requires_intro_desc',
      descriptionKey: '@mission_requires_intro_desc',
      description: 'This mission is unlocked by an intro.',
      isIntro: false,
      requiredIntros: ['intro-contract'],
      linkedIntros: ['intro-contract'],
      blueprintRewards: [{ blueprintPool: 'pool-1', chance: 1, poolName: 'Pool', trigger: 'complete' }],
      hasPersonalCooldown: false,
      personalCooldownTime: 0,
      timeToComplete: 0,
      rewardUEC: null,
      buyIn: null,
      prerequisites: {},
      haulingOrders: null,
      shipEncounters: null,
      minStanding: null,
    };
    const rows = buildMissionRows([contract as never], collectBlueprintChainData([contract as never]), {
      'pool-1': { name: 'Pool', source: 'mission', blueprints: [{ weight: 1, name: 'Blueprint' }] },
    } as never);

    assert.strictEqual(rows[0].TitleNote, ' <EM4>[BP]</EM4>');
  });

  it('builds contract intel without legal labels or static runtime-token replacements', () => {
    const contract = {
      id: 'intel',
      titleKey: '@mission_title',
      title: 'Intel Mission',
      descriptionLocKey: '@mission_desc',
      descriptionKey: '@mission_desc',
      description: 'Go to ~mission(Location|Address) and get paid ~mission(reward).',
      isIntro: false,
      hasPersonalCooldown: true,
      personalCooldownTime: 60,
      timeToComplete: 20,
      rewardUEC: 10000,
      buyIn: 1000,
      illegal: true,
      factionGuid: 'faction-1',
      rewardRepCalculated: 50,
      prerequisites: {},
      haulingOrders: null,
      shipEncounters: null,
      minStanding: { name: 'Contractor' },
    };
    const rows = buildMissionRows([contract as never], collectBlueprintChainData([contract as never]), {}, {
      factions: { 'faction-1': { name: 'Head Hunters' } },
      resourcePools: {},
    } as never);
    const descRow = rows.find((row) => row['Localization Key'] === 'mission_desc');

    assert.ok(descRow);
    assert.match(descRow.ContractIntel, /Time Limit: 20 min/);
    assert.match(descRow.ContractIntel, /Cooldown: 1 h/);
    assert.match(descRow.ContractIntel, /Buy-in: 1,000 aUEC/);
    assert.match(descRow.ContractIntel, /Faction Rep: Head Hunters \+50/);
    assert.doesNotMatch(descRow.ContractIntel, /Illegal|Location|~mission/);
    assert.doesNotMatch(descRow.ContractIntel, /Reward: 10,000 aUEC/);
  });

  it('deduplicates repeated localization keys with deterministic last-row wins behavior', () => {
    const base = {
      titleKey: '@shared_title',
      title: 'Shared Title',
      descriptionLocKey: '@shared_desc',
      descriptionKey: '@shared_desc',
      description: 'Shared description.',
      isIntro: false,
      hasPersonalCooldown: false,
      personalCooldownTime: 0,
      timeToComplete: 0,
      rewardUEC: null,
      buyIn: null,
      prerequisites: {},
      haulingOrders: null,
      shipEncounters: null,
      minStanding: null,
    };
    const rows = buildMissionRows(
      [
        { ...base, id: 'first', title: 'First Title' },
        { ...base, id: 'second', title: 'Second Title', isIntro: true },
      ] as never,
      collectBlueprintChainData([
        { ...base, id: 'first' },
        { ...base, id: 'second', isIntro: true },
      ] as never),
      {},
    );

    assert.strictEqual(rows.filter((row) => row['Localization Key'] === 'shared_title').length, 1);
    assert.strictEqual(rows.find((row) => row['Localization Key'] === 'shared_title')?.Description, 'Second Title');
    assert.strictEqual(rows.find((row) => row['Localization Key'] === 'shared_title')?.TitleNote, ' <EM4>[Intro]</EM4>');
  });

  it('keeps true intro title tags when a later contract shares the same title key', () => {
    const base = {
      titleKey: '@shared_intro_title',
      title: 'Shared Intro Title',
      descriptionLocKey: '@shared_intro_desc',
      descriptionKey: '@shared_intro_desc',
      description: 'Shared description.',
      hasPersonalCooldown: false,
      personalCooldownTime: 0,
      timeToComplete: 0,
      rewardUEC: null,
      buyIn: null,
      prerequisites: {},
      haulingOrders: null,
      shipEncounters: null,
      minStanding: null,
    };
    const contracts = [
      { ...base, id: 'true-intro', isIntro: true },
      { ...base, id: 'unlocked', isIntro: false, requiredIntros: ['true-intro'] },
    ];
    const rows = buildMissionRows(contracts as never, collectBlueprintChainData(contracts as never), {});

    assert.strictEqual(rows.find((row) => row['Localization Key'] === 'shared_intro_title')?.TitleNote, ' <EM4>[Intro]</EM4>');
  });
});
