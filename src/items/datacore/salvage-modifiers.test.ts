import assert from 'node:assert/strict';
import test from 'node:test';
import config from './salvage-modifiers';

const getTargetKeys = config.getTargetKeys;

assert.ok(getTargetKeys, 'salvage-modifiers config must define getTargetKeys');

test('salvage modifiers skip HUD label keys instead of patching player-facing HUD strings', () => {
  assert.deepEqual(
    getTargetKeys(
      {
        'Entity Class': 'salvage_modifier_tractor_template',
        'Name Key': 'salvage_HUD_TractorBeam_Module',
        'Description Key': '',
      },
      config.nameKeyToDescKey ?? ((nameKey) => nameKey.replace('Name', 'Desc')),
    ),
    [],
  );
});

test('salvage modifiers still use item name keys that convert to description keys', () => {
  assert.deepEqual(
    getTargetKeys(
      {
        'Entity Class': 'salvage_modifier_scraper_abrade',
        'Name Key': 'item_scraper_abrade_Name',
        'Description Key': '',
      },
      config.nameKeyToDescKey ?? ((nameKey) => nameKey.replace('Name', 'Desc')),
    ),
    ['item_scraper_abrade_Desc'],
  );
});
