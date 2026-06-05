import assert from 'node:assert/strict';
import test from 'node:test';
import { makeGetTargetKeys, makeGetTargetKeysFromPrefixMap } from './types';

test('makeGetTargetKeys prefers raw DataCore description keys over entity-class derivation', () => {
  const getTargetKeys = makeGetTargetKeys('shld_', 'SHLD_');

  assert.deepEqual(
    getTargetKeys(
      {
        'Entity Class': 'shld_aegs_s04_reclaimer',
        'Name Key': 'item_NameSHLD_AEGS_S04_Reclaimer_SCItem',
        'Description Key': 'item_DescSHLD_AEGS_S04_Reclaimer_SCItem',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    ['item_DescSHLD_AEGS_S04_Reclaimer_SCItem'],
  );
});

test('makeGetTargetKeys falls back to raw DataCore name keys before entity-class derivation', () => {
  const getTargetKeys = makeGetTargetKeys('cool_', 'COOL_');

  assert.deepEqual(
    getTargetKeys(
      {
        'Entity Class': 'cool_acom_s01_iceplunge',
        'Name Key': 'item_Name_COOL_ACOM_S01_IcePlunge',
        'Description Key': '',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    ['item_Desc_COOL_ACOM_S01_IcePlunge'],
  );
});

test('makeGetTargetKeys keeps entity-class derivation as an older CSV fallback', () => {
  const getTargetKeys = makeGetTargetKeys('jdrv_', 'JDRV_');

  assert.deepEqual(
    getTargetKeys({ 'Entity Class': 'jdrv_orig_s3_holvn' }, (nameKey) => nameKey.replace('Name', 'Desc')),
    ['item_DescJDRV_ORIG_S3_HOLVN'],
  );
});

test('makeGetTargetKeysFromPrefixMap also prefers raw DataCore keys', () => {
  const getTargetKeys = makeGetTargetKeysFromPrefixMap([
    ['wpn_', 'GUN_'],
    ['barrel_', 'FPS_ATTACH_'],
  ]);

  assert.deepEqual(
    getTargetKeys(
      {
        'Entity Class': 'barrel_behr_suppressor',
        'Name Key': 'item_NameFPS_ATTACH_Behr_Suppressor',
        'Description Key': 'item_DescFPS_ATTACH_Behr_Suppressor',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    ['item_DescFPS_ATTACH_Behr_Suppressor'],
  );
});
