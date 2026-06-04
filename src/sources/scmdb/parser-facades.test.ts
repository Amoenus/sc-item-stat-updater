import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMiningJournalRows } from './mining-parser';
import { buildMissionRows, collectBlueprintChainData } from './mission-parser';

test('SCMDB mining parser facade exposes mining normalization helpers', () => {
  const rows = buildMiningJournalRows({
    mineableElements: {
      easy: { name: 'Easyite (Ore)', rarity: 'common', resistance: 0.1, instability: 50 },
    },
    refineryProfiles: {},
    refineries: {},
  });

  assert.equal(rows.length > 0, true);
});

test('SCMDB mission parser facade exposes mission normalization helpers', () => {
  const contract = {
    id: 'intro',
    titleKey: '@mission_intro_title',
    title: 'Intro Mission',
    descriptionLocKey: '@mission_intro_desc',
    descriptionKey: '@mission_intro_desc',
    description: 'Meet the client.',
    isIntro: true,
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

  const rows = buildMissionRows([contract as never], collectBlueprintChainData([contract as never]), {} as never);

  assert.equal(rows[0]['Localization Key'], 'mission_intro_title');
});
