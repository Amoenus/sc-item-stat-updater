import assert from 'node:assert/strict';
import test from 'node:test';
import config from './weapon-personal';

const buildValue = config.buildValue;

assert.ok(buildValue, 'weapon-personal config must define buildValue');

test('weapon-personal formats melee knives without firearm stat sections', () => {
  const value = buildValue(
    {
      'Entity Class': 'apar_melee_01',
      Class: 'Knife',
      Manufacturer: 'APAR',
      'Manufacturer Name Key': 'manufacturer_NameAPAR',
      Size: '1',
    },
    'The Demon Fang is a simple yet sinister split blade knife.',
    'Item Type: Personal Weapon\\nManufacturer: APAR\\nSize: 1\\n\\n-- Damage --\\nAlpha Damage: \\nRate of Fire:  RPM',
    'item_Descapar_melee_01',
    { localizationValue: (key) => (key === 'manufacturer_NameAPAR' ? 'Apocalypse Arms' : '') },
  );

  assert.equal(
    value,
    'Manufacturer: Apocalypse Arms\\nItem Type: Knife\\nClass: Melee\\n\\nSize: 15 cm\\n\\nThe Demon Fang is a simple yet sinister split blade knife.',
  );
});

test('weapon-personal preserves existing melee display sizes when they are already specific', () => {
  const value = buildValue(
    {
      'Entity Class': 'banu_melee_02',
      Class: 'Knife',
      Manufacturer: 'BANU',
      'Manufacturer Name Key': 'manufacturer_NameBANU',
      Size: '1',
    },
    'The Myondo is a distinct, curved blade.',
    'Manufacturer: Banu\\nItem Type: Knife\\nClass: Melee\\n\\nSize: N/A\\n\\nOld flavor',
    'item_Descbanu_melee_02',
    { localizationValue: (key) => (key === 'manufacturer_NameBANU' ? 'Banu' : '') },
  );

  assert.equal(
    value,
    'Manufacturer: Banu\\nItem Type: Knife\\nClass: Melee\\n\\nSize: N/A\\n\\nThe Myondo is a distinct, curved blade.',
  );
});

test('weapon-personal keeps firearm rows on the firearm formatter', () => {
  const value = buildValue(
    {
      'Entity Class': 'behr_pistol_ballistic_01',
      Class: 'Ballistic',
      Manufacturer: 'BEHR',
      Size: '1',
      'Damage Alpha': '8',
      'Rate of Fire': '300',
      'Fire Mode': 'Single',
      'Projectile Speed': '450',
      'Ammo Range': '900',
      'Ammo Quantity': '12',
    },
    'Sidearm flavor.',
    '',
    'item_Descbehr_pistol_ballistic_01',
    { localizationValue: () => '' },
  );

  assert.match(value, /^Item Type: Personal Weapon\\nManufacturer: BEHR/);
  assert.match(value, /-- Damage --\\nAlpha Damage: 8\\nRate of Fire: 300 RPM/);
});

test('weapon-personal does not target grenade rows claimed by throwable data', () => {
  const targetKeys = config.getTargetKeys?.(
    {
      'Entity Class': 'behr_gren_frag_01',
      'Name Key': 'item_Namebehr_frag_grenade_01',
      'Description Key': 'item_Descbehr_frag_grenade_01',
      Class: 'Grenade',
    },
    (nameKey) => nameKey.replace('Name', 'Desc'),
  );

  assert.deepEqual(targetKeys, []);
  assert.equal(config.descKeyMatch('item_descbehr_frag_grenade_01'), false);
});

test('weapon-personal formats portable lights without firearm stat sections', () => {
  const value = buildValue(
    {
      'Entity Class': 'carryable_1h_cu_glowstick_blue',
      'Name Key': 'item_Nameun_portable_light_1_a_cyan',
      'Description Key': 'item_Descun_portable_light_1_a_cyan',
      Class: 'Grenade',
      Manufacturer: 'SHIN',
      'Manufacturer Name Key': 'manufacturer_NameSHIN',
      Size: '1',
      'Damage Alpha': '',
      'Rate of Fire': '',
    },
    'Illuminate the way forward.',
    'Item Type: Personal Weapon\\nManufacturer: SHIN\\nSize: 1\\n\\n-- Damage --\\nAlpha Damage: \\nRate of Fire:  RPM',
    'item_Descun_portable_light_1_a_cyan',
    { localizationValue: (key) => (key === 'manufacturer_NameSHIN' ? 'Shubin Interstellar' : '') },
  );

  assert.equal(value, 'Manufacturer: Shubin Interstellar\\n\\nIlluminate the way forward.');
});
