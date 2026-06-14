import assert from 'node:assert/strict';
import test from 'node:test';
import {
  makeAlternateDataCoreDescKeys,
  makeGetTargetKeys,
  makeGetTargetKeysFromPrefixMap,
  resolvePatchableDataCoreDescriptionTargets,
} from './types';

test('resolvePatchableDataCoreDescriptionTargets uses explicit description relationships', () => {
  assert.deepEqual(
    resolvePatchableDataCoreDescriptionTargets(
      {
        'Name Key': 'item_NameCOOL_ACOM_S01_IcePlunge',
        'Description Key': 'item_DescCOOL_ACOM_S01_IcePlunge',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    ['item_DescCOOL_ACOM_S01_IcePlunge'],
  );
});

test('resolvePatchableDataCoreDescriptionTargets preserves description-shaped explicit relationships', () => {
  assert.deepEqual(
    resolvePatchableDataCoreDescriptionTargets(
      {
        'Name Key': 'item_Mining_Laser_Hofstede',
        'Description Key': 'item_Mining_Laser_Hofstede_Desc',
      },
      (nameKey) => (nameKey.startsWith('item_Mining_') ? `${nameKey}_Desc` : nameKey.replace('Name', 'Desc')),
    ),
    ['item_Mining_Laser_Hofstede_Desc'],
  );
});

test('resolvePatchableDataCoreDescriptionTargets converts name-shaped description relationships to description keys', () => {
  assert.deepEqual(
    resolvePatchableDataCoreDescriptionTargets(
      {
        'Name Key': 'item_NameVNCL_PlasmaCannon_S2',
        'Description Key': 'item_NameVNCL_PlasmaCannon_S2',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    ['item_DescVNCL_PlasmaCannon_S2'],
  );
});

test('resolvePatchableDataCoreDescriptionTargets derives only distinct description keys from name relationships', () => {
  assert.deepEqual(
    resolvePatchableDataCoreDescriptionTargets(
      {
        'Name Key': 'item_NameCOOL_ACOM_S01_IcePlunge',
        'Description Key': '',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    ['item_DescCOOL_ACOM_S01_IcePlunge'],
  );

  assert.deepEqual(
    resolvePatchableDataCoreDescriptionTargets(
      {
        'Name Key': 'item_displayType_TractorBeam',
        'Description Key': '',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    [],
  );
});

test('resolvePatchableDataCoreDescriptionTargets does not fall back when DataCore exposes an unusable description relationship', () => {
  assert.deepEqual(
    resolvePatchableDataCoreDescriptionTargets(
      {
        'Name Key': 'item_NameCOOL_ACOM_S01_IcePlunge',
        'Description Key': 'LOC_PLACEHOLDER',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    [],
  );
});

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

test('makeGetTargetKeys ignores raw DataCore name keys that are not description-key convertible', () => {
  const getTargetKeys = makeGetTargetKeys('turret_', 'TURR_');

  assert.deepEqual(
    getTargetKeys(
      {
        'Entity Class': 'turret_unmanned_kbar_aa_ground_ea',
        'Name Key': 'sm_ui_CTRL_A',
        'Description Key': '',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    [],
  );
});

test('makeGetTargetKeys keeps entity-class derivation as an older CSV fallback', () => {
  const getTargetKeys = makeGetTargetKeys('jdrv_', 'JDRV_');

  assert.deepEqual(
    getTargetKeys({ 'Entity Class': 'jdrv_orig_s3_holvn' }, (nameKey) => nameKey.replace('Name', 'Desc')),
    ['item_DescJDRV_ORIG_S3_HOLVN'],
  );
});

test('makeGetTargetKeys skips entity-class derivation when the configured prefix does not match', () => {
  const getTargetKeys = makeGetTargetKeys('jdrv_', 'JDRV_');

  assert.deepEqual(
    getTargetKeys({ 'Entity Class': 'helper_orig_s3_holvn' }, (nameKey) => nameKey.replace('Name', 'Desc')),
    [],
  );
});

test('makeGetTargetKeys does not derive keys when DataCore exposes placeholder localization keys', () => {
  const getTargetKeys = makeGetTargetKeys('cool_', 'COOL_');

  assert.deepEqual(
    getTargetKeys(
      {
        'Entity Class': 'cool_acom_s01_iceplunge',
        'Name Key': '@LOC_PLACEHOLDER',
        'Description Key': '@LOC_UNINITIALIZED',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    [],
  );
});

test('makeGetTargetKeys normalizes raw DataCore localization key prefixes', () => {
  const getTargetKeys = makeGetTargetKeys('cool_', 'COOL_');

  assert.deepEqual(
    getTargetKeys(
      {
        'Entity Class': 'cool_acom_s01_iceplunge',
        'Name Key': '@item_Name_COOL_ACOM_S01_IcePlunge',
        'Description Key': '@item_Desc_COOL_ACOM_S01_IcePlunge',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    ['item_Desc_COOL_ACOM_S01_IcePlunge'],
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

test('makeAlternateDataCoreDescKeys creates underscore and SCItem localization variants', () => {
  const alternateKeys = makeAlternateDataCoreDescKeys('QDRV', { includeScItemAlias: true });

  assert.deepEqual(alternateKeys('item_DescQDRV_JUST_S03_Agni_SCItem'), [
    'item_Desc_QDRV_JUST_S03_Agni_SCItem',
    'item_DescQDRV_JUST_S03_Agni',
    'item_Desc_QDRV_JUST_S03_Agni',
  ]);
});

test('makeAlternateDataCoreDescKeys can omit SCItem variants for families that do not use them', () => {
  const alternateKeys = makeAlternateDataCoreDescKeys('SHLD');

  assert.deepEqual(alternateKeys('item_Desc_SHLD_GODI_S01_FR66'), ['item_DescSHLD_GODI_S01_FR66']);
});
