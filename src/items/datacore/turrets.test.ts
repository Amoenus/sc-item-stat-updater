import assert from 'node:assert/strict';
import test from 'node:test';
import config from './turrets';

const getTargetKeys = config.getTargetKeys;

assert.ok(getTargetKeys, 'turrets config must define getTargetKeys');

test('turrets prefer explicit DataCore description keys over short-name aliases', () => {
  assert.deepEqual(
    getTargetKeys(
      {
        'Entity Class': 'turr_aegs_s4',
        'Name Key': 'item_NameTURR_AEGS_S04',
        'Description Key': 'item_DescTURR_AEGS_S04_Graph',
        'Short Name Key': 'item_DescTURR_AEGS_S04_Short',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    ['item_DescTURR_AEGS_S04_Graph'],
  );
});

test('turrets use description-shaped short name keys only when DataCore lacks a description key', () => {
  assert.deepEqual(
    getTargetKeys(
      {
        'Entity Class': 'turr_aegs_s4',
        'Name Key': 'item_NameTURR_AEGS_S04',
        'Description Key': '',
        'Short Name Key': 'item_DescTURR_AEGS_S04_Short',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    ['item_DescTURR_AEGS_S04_Short'],
  );
});

test('turrets derive description keys only when DataCore lacks direct description relationships', () => {
  assert.deepEqual(
    getTargetKeys(
      {
        'Entity Class': 'turr_aegs_s4',
        'Name Key': 'item_NameTURR_AEGS_S04',
        'Description Key': '',
        'Short Name Key': '',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    ['item_DescTURR_AEGS_S04'],
  );
});

test('turrets ignore placeholder direct keys before short-name and fallback aliases', () => {
  assert.deepEqual(
    getTargetKeys(
      {
        'Entity Class': 'turr_aegs_s4',
        'Name Key': 'item_NameTURR_AEGS_S04',
        'Description Key': 'LOC_PLACEHOLDER',
        'Short Name Key': 'LOC_PLACEHOLDER',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    ['item_DescTURR_AEGS_S04'],
  );
});
