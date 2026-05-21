import assert from 'node:assert';
import { describe, it } from 'node:test';
import { buildReverseNameIndex, resolveLocalizationKeys } from './key-resolver';

describe('buildReverseNameIndex', () => {
  it('builds a map from display name to INI key', () => {
    const lines = [
      'item_Name_someWeapon=Laser Cannon',
      'item_Name_anotherItem=Shield Generator',
      '; comment line',
      'unrelated_key=value',
    ];
    const index = buildReverseNameIndex(lines);
    assert.strictEqual(index.get('Laser Cannon'), 'item_Name_someWeapon');
    assert.strictEqual(index.get('Shield Generator'), 'item_Name_anotherItem');
    assert.strictEqual(index.has('value'), false);
  });

  it('skips auxiliary suffix keys (_short, _mag, _barrel, _ammo)', () => {
    const lines = [
      'item_Name_weapon=Plasma Gun',
      'item_Name_weapon_short=Plasma Gun',
      'item_Name_weapon_mag=Plasma Gun Mag',
      'item_Name_weapon_barrel=Plasma Gun Barrel',
      'item_Name_weapon_ammo=Plasma Gun Ammo',
    ];
    const index = buildReverseNameIndex(lines);
    assert.strictEqual(index.get('Plasma Gun'), 'item_Name_weapon');
  });

  it('first key wins for duplicate display names', () => {
    const lines = ['item_Name_first=Duplicate Name', 'item_Name_second=Duplicate Name'];
    const index = buildReverseNameIndex(lines);
    assert.strictEqual(index.get('Duplicate Name'), 'item_Name_first');
  });
});

describe('resolveLocalizationKeys', () => {
  const reverseIndex = new Map([
    ['Laser Cannon', 'item_Name_laser_cannon'],
    ['Shield Generator', 'item_Name_shield_gen'],
    ['MISC Prospector Laser', 'item_Name_prospector_laser'],
  ]);

  it('does NOT mutate the input rows array', () => {
    const rows = [
      { Name: 'Laser Cannon', Power: '100' },
      { Name: 'Shield Generator', Power: '50' },
    ];
    const original = rows.map((r) => ({ ...r }));
    const originalLength = rows.length;

    resolveLocalizationKeys(rows, 'Name', reverseIndex);

    assert.strictEqual(rows.length, originalLength, 'input array length must not change');
    for (let i = 0; i < rows.length; i++) {
      assert.deepStrictEqual(rows[i], original[i], `row[${i}] must not be mutated`);
    }
  });

  it('does NOT add Localization Key to original row objects', () => {
    const rows = [{ Name: 'Laser Cannon', Power: '100' }];
    resolveLocalizationKeys(rows, 'Name', reverseIndex);
    assert.strictEqual('Localization Key' in rows[0], false, 'original row must not gain Localization Key');
  });

  it('returns resolved rows with Localization Key added', () => {
    const rows = [
      { Name: 'Laser Cannon', Power: '100' },
      { Name: 'Shield Generator', Power: '50' },
    ];
    const { resolved } = resolveLocalizationKeys(rows, 'Name', reverseIndex);
    assert.strictEqual(resolved.length, 2);
    assert.strictEqual(resolved[0]['Localization Key'], 'item_Name_laser_cannon');
    assert.strictEqual(resolved[0]['Power'], '100');
    assert.strictEqual(resolved[1]['Localization Key'], 'item_Name_shield_gen');
  });

  it('puts unresolved names in the unresolved array', () => {
    const rows = [
      { Name: 'Laser Cannon', Power: '100' },
      { Name: 'Unknown Widget', Power: '0' },
    ];
    const { resolved, unresolved } = resolveLocalizationKeys(rows, 'Name', reverseIndex);
    assert.strictEqual(resolved.length, 1);
    assert.strictEqual(resolved[0]['Localization Key'], 'item_Name_laser_cannon');
    assert.deepStrictEqual(unresolved, ['Unknown Widget']);
  });

  it('marks rows with empty name as unresolved with "(empty)"', () => {
    const rows = [{ Name: '', Power: '0' }];
    const { resolved, unresolved } = resolveLocalizationKeys(rows, 'Name', reverseIndex);
    assert.strictEqual(resolved.length, 0);
    assert.deepStrictEqual(unresolved, ['(empty)']);
  });

  it('resolves via suffix match (trailing word match)', () => {
    const rows = [{ Name: 'Prospector Laser', Power: '200' }];
    const { resolved } = resolveLocalizationKeys(rows, 'Name', reverseIndex);
    assert.strictEqual(resolved.length, 1);
    assert.strictEqual(resolved[0]['Localization Key'], 'item_Name_prospector_laser');
  });

  it('resolves via parenthetical strip', () => {
    const exactIndex = new Map([['Shield Generator', 'item_Name_shield_gen']]);
    const rows = [{ Name: 'Shield Generator (Ground)', Power: '50' }];
    const { resolved } = resolveLocalizationKeys(rows, 'Name', exactIndex);
    assert.strictEqual(resolved.length, 1);
    assert.strictEqual(resolved[0]['Localization Key'], 'item_Name_shield_gen');
  });

  it('savedMapping takes priority over reverseIndex', () => {
    const savedMapping = new Map([['Laser Cannon', 'item_Name_saved_override']]);
    const rows = [{ Name: 'Laser Cannon', Power: '100' }];
    const { resolved } = resolveLocalizationKeys(rows, 'Name', reverseIndex, undefined, savedMapping);
    assert.strictEqual(resolved[0]['Localization Key'], 'item_Name_saved_override');
  });

  it('resolved rows include all original properties plus Localization Key', () => {
    const rows = [{ Name: 'Laser Cannon', Power: '100', Size: '2', Grade: 'A' }];
    const { resolved } = resolveLocalizationKeys(rows, 'Name', reverseIndex);
    const row = resolved[0];
    assert.strictEqual(row['Name'], 'Laser Cannon');
    assert.strictEqual(row['Power'], '100');
    assert.strictEqual(row['Size'], '2');
    assert.strictEqual(row['Grade'], 'A');
    assert.strictEqual(row['Localization Key'], 'item_Name_laser_cannon');
  });

  it('builds the mapping from resolved names', () => {
    const rows = [
      { Name: 'Laser Cannon', Power: '100' },
      { Name: 'Shield Generator', Power: '50' },
    ];
    const { mapping } = resolveLocalizationKeys(rows, 'Name', reverseIndex);
    assert.strictEqual(mapping.get('Laser Cannon'), 'item_Name_laser_cannon');
    assert.strictEqual(mapping.get('Shield Generator'), 'item_Name_shield_gen');
  });

  it('seeds mapping from savedMapping even for unresolved items', () => {
    const savedMapping = new Map([['Old Item', 'item_Name_old']]);
    const rows = [{ Name: 'Laser Cannon', Power: '100' }];
    const { mapping } = resolveLocalizationKeys(rows, 'Name', reverseIndex, undefined, savedMapping);
    assert.strictEqual(mapping.get('Old Item'), 'item_Name_old');
    assert.strictEqual(mapping.get('Laser Cannon'), 'item_Name_laser_cannon');
  });
});
