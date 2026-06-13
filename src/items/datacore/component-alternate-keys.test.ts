import assert from 'node:assert/strict';
import test from 'node:test';
import coolers from './coolers';
import powerplants from './powerplants';
import quantumDrives from './quantum-drives';
import shields from './shields';

test('coolers trust explicit DataCore description keys without alternate aliases', () => {
  assert.ok(coolers.getTargetKeys, 'coolers config must define getTargetKeys');

  assert.deepEqual(
    coolers.getTargetKeys(
      {
        'Entity Class': 'cool_aegs_s02_boreal',
        'Name Key': 'item_NameCOOL_AEGS_S02_Boreal',
        'Description Key': 'item_DescCOOL_AEGS_S02_Boreal',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    ['item_DescCOOL_AEGS_S02_Boreal'],
  );
});

test('coolers use legacy SCItem aliases only when DataCore lacks a description key', () => {
  assert.ok(coolers.getTargetKeys, 'coolers config must define getTargetKeys');

  assert.deepEqual(
    coolers.getTargetKeys(
      {
        'Entity Class': 'cool_aegs_s01_glacier',
        'Name Key': 'item_Name_COOL_AEGS_S01_Glacier',
        'Description Key': '',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    [
      'item_Desc_COOL_AEGS_S01_Glacier',
      'item_DescCOOL_AEGS_S01_Glacier',
      'item_Desc_COOL_AEGS_S01_Glacier_SCItem',
      'item_DescCOOL_AEGS_S01_Glacier_SCItem',
    ],
  );
});

test('quantum drives trust explicit DataCore description keys without non-SCItem aliases', () => {
  assert.ok(quantumDrives.getTargetKeys, 'quantum drives config must define getTargetKeys');

  assert.deepEqual(
    quantumDrives.getTargetKeys(
      {
        'Entity Class': 'qdrv_just_s03_agni',
        'Name Key': 'item_NameQDRV_JUST_S03_Agni_SCItem',
        'Description Key': 'item_DescQDRV_JUST_S03_Agni_SCItem',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    ['item_DescQDRV_JUST_S03_Agni_SCItem'],
  );
});

test('quantum drives use non-SCItem aliases only when DataCore lacks a description key', () => {
  assert.ok(quantumDrives.getTargetKeys, 'quantum drives config must define getTargetKeys');

  assert.deepEqual(
    quantumDrives.getTargetKeys(
      {
        'Entity Class': 'qdrv_just_s03_agni',
        'Name Key': 'item_NameQDRV_JUST_S03_Agni_SCItem',
        'Description Key': '',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    [
      'item_DescQDRV_JUST_S03_Agni_SCItem',
      'item_Desc_QDRV_JUST_S03_Agni_SCItem',
      'item_DescQDRV_JUST_S03_Agni',
      'item_Desc_QDRV_JUST_S03_Agni',
    ],
  );
});

test('powerplants trust explicit DataCore description keys without aliases', () => {
  assert.ok(powerplants.getTargetKeys, 'powerplants config must define getTargetKeys');

  assert.deepEqual(
    powerplants.getTargetKeys(
      {
        'Entity Class': 'powr_lplt_s02_fullforce',
        'Name Key': 'item_Name_POWR_LPLT_S02_FullForce',
        'Description Key': 'item_Desc_POWR_LPLT_S02_FullForce',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    ['item_Desc_POWR_LPLT_S02_FullForce'],
  );
});

test('powerplants use aliases only when DataCore lacks a description key', () => {
  assert.ok(powerplants.getTargetKeys, 'powerplants config must define getTargetKeys');

  assert.deepEqual(
    powerplants.getTargetKeys(
      {
        'Entity Class': 'powr_lplt_s02_fullforce',
        'Name Key': 'item_Name_POWR_LPLT_S02_FullForce',
        'Description Key': '',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    [
      'item_Desc_POWR_LPLT_S02_FullForce',
      'item_DescPOWR_LPLT_S02_FullForce',
      'item_Desc_POWR_LPLT_S02_FullForce_SCItem',
      'item_DescPOWR_LPLT_S02_FullForce_SCItem',
    ],
  );
});

test('shields trust explicit DataCore description keys without alternate aliases', () => {
  assert.ok(shields.getTargetKeys, 'shields config must define getTargetKeys');

  assert.deepEqual(
    shields.getTargetKeys(
      {
        'Entity Class': 'shld_godi_s01_fr66',
        'Name Key': 'item_Name_SHLD_GODI_S01_FR66',
        'Description Key': 'item_Desc_SHLD_GODI_S01_FR66',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    ['item_Desc_SHLD_GODI_S01_FR66'],
  );
});

test('shields use alternate aliases only when DataCore lacks a description key', () => {
  assert.ok(shields.getTargetKeys, 'shields config must define getTargetKeys');

  assert.deepEqual(
    shields.getTargetKeys(
      {
        'Entity Class': 'shld_godi_s01_fr66',
        'Name Key': 'item_Name_SHLD_GODI_S01_FR66',
        'Description Key': '',
      },
      (nameKey) => nameKey.replace('Name', 'Desc'),
    ),
    ['item_Desc_SHLD_GODI_S01_FR66', 'item_DescSHLD_GODI_S01_FR66'],
  );
});
