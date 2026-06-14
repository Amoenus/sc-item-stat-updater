import assert from 'node:assert/strict';
import test from 'node:test';
import config from './mining-lasers';

const getTargetKeys = config.getTargetKeys;

assert.ok(getTargetKeys, 'mining-lasers config must define getTargetKeys');

test('mining-lasers prefer raw DataCore localization keys', () => {
  assert.deepEqual(
    getTargetKeys(
      {
        'Entity Class': 'mining_laser_shin_s01_hofstede',
        'Name Key': 'item_Mining_Laser_Hofstede',
        'Description Key': 'item_Mining_Laser_Hofstede_Desc',
      },
      (nameKey) => `${nameKey}_Desc`,
    ),
    ['item_Mining_Laser_Hofstede_Desc'],
  );
});

test('mining-lasers skip prefix fallback for non-mining-laser helper rows', () => {
  assert.deepEqual(
    getTargetKeys(
      {
        'Entity Class': 'helper_shin_s01_hofstede',
        'Name Key': '',
        'Description Key': '',
      },
      (nameKey) => `${nameKey}_Desc`,
    ),
    [],
  );
});

test('mining-lasers do not derive keys when DataCore exposes placeholder localization keys', () => {
  assert.deepEqual(
    getTargetKeys(
      {
        'Entity Class': 'mining_laser_shin_s01_hofstede',
        'Name Key': 'LOC_PLACEHOLDER',
        'Description Key': 'LOC_UNINITIALIZED',
      },
      (nameKey) => `${nameKey}_Desc`,
    ),
    [],
  );
});
