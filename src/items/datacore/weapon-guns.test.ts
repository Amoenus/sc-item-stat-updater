import assert from 'node:assert/strict';
import test from 'node:test';
import config from './weapon-guns';

const getTargetKeys = config.getTargetKeys;

assert.ok(getTargetKeys, 'weapon-guns config must define getTargetKeys');

test('weapon-guns keeps explicit DataCore family description keys instead of variant name heuristics', () => {
  assert.deepEqual(
    getTargetKeys(
      {
        'Entity Class': 'apar_ballisticscattergun_s1_shark',
        'Name Key': 'item_NameAPAR_BallisticScatterGun_S1_Shark',
        'Description Key': 'item_DescAPAR_BallisticScatterGun_S1',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    ['item_DescAPAR_BallisticScatterGun_S1'],
  );
});

test('weapon-guns derives description keys when DataCore repeats the name key', () => {
  assert.deepEqual(
    getTargetKeys(
      {
        'Entity Class': 'vncl_plasmacannon_s2',
        'Name Key': 'item_NameVNCL_PlasmaCannon_S2',
        'Description Key': 'item_NameVNCL_PlasmaCannon_S2',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    ['item_DescVNCL_PlasmaCannon_S2'],
  );
});

test('weapon-guns keeps ordinary raw description keys', () => {
  assert.deepEqual(
    getTargetKeys(
      {
        'Entity Class': 'behr_ballisticcannon_s4',
        'Name Key': 'item_NameBEHR_BallisticCannon_S4',
        'Description Key': 'item_DescBEHR_BallisticCannon_S4',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    ['item_DescBEHR_BallisticCannon_S4'],
  );
});

test('weapon-guns derives variant description keys only when DataCore lacks a description key', () => {
  assert.deepEqual(
    getTargetKeys(
      {
        'Entity Class': 'apar_ballisticscattergun_s1_shark',
        'Name Key': 'item_NameAPAR_BallisticScatterGun_S1_Shark',
        'Description Key': '',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    ['item_DescAPAR_BallisticScatterGun_S1_Shark'],
  );
});
