import assert from 'node:assert/strict';
import test from 'node:test';
import type { ItemConfig } from '../../enrichment/item-config';
import config from './missiles';

const buildValue = config.buildValue as NonNullable<ItemConfig['buildValue']>;

assert.ok(buildValue, 'missiles config must define buildValue');

test('missiles omit unavailable lock ranges and blank health', () => {
  const value = buildValue(
    {
      'Entity Class': 'apar_special_ballistic_02_missile',
      Manufacturer: 'XIAN',
      Size: '1',
      'Tracking Signal': 'CrossSection',
      'Damage Total': '1100',
      'Damage Physical': '300',
      'Damage Energy': '800',
      'Damage Distortion': '0',
      Speed: '1000',
      'Arm Delay': '1.5',
      'Lock Delay': '3',
      'Lock Range': '-1 - -1',
      'Lock Angle': '30',
      'Explosion Radius': '2 - 3',
      Health: '',
    },
    'Ballistic missile ammo for the Animus missile launcher.',
    '',
    'item_Descapar_special_ballistic_02_missile',
    { localizationValue: () => '' },
  );

  assert.match(value, /^Item Type: Missile\\nManufacturer: XIAN/);
  assert.doesNotMatch(value, /Lock Range:/);
  assert.doesNotMatch(value, /Health:/);
  assert.match(value, /Lock Angle: 30/);
  assert.match(value, /Radius: 2 - 3/);
});
