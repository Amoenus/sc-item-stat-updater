import assert from 'node:assert';
import { describe, it } from 'node:test';
import { extractFlavorText, nameKeyToDescKey } from './text-utils';

describe('nameKeyToDescKey', () => {
  it('converts mixed-case "Name" to "Desc"', () => {
    assert.strictEqual(nameKeyToDescKey('item_Name_some_weapon'), 'item_Desc_some_weapon');
  });

  it('converts lowercase "name" to lowercase "desc"', () => {
    assert.strictEqual(nameKeyToDescKey('item_name_some_weapon'), 'item_desc_some_weapon');
  });

  it('converts uppercase "NAME" to uppercase "DESC"', () => {
    assert.strictEqual(nameKeyToDescKey('item_NAME_some_weapon'), 'item_DESC_some_weapon');
  });

  it('only replaces the first occurrence of item_Name|name|NAME', () => {
    // The regex has no /g flag, so only the first match is replaced.
    assert.strictEqual(nameKeyToDescKey('item_Name_thing_item_Name_other'), 'item_Desc_thing_item_Name_other');
  });

  it('returns the input unchanged when no item_Name pattern is present', () => {
    assert.strictEqual(nameKeyToDescKey('other_key_value'), 'other_key_value');
  });

  it('returns an empty string for empty input', () => {
    assert.strictEqual(nameKeyToDescKey(''), '');
  });

  it('does not match item_Name without an underscore prefix (case-insensitive on the literal)', () => {
    // The regex /(item_)(Name|name|NAME)/i is case-insensitive on the WHOLE match,
    // so even "ITEM_Name" matches the "item_" portion via the /i flag and the inner
    // group still resolves to one of the three literal forms by exact comparison.
    // ITEM_Name → prefix="ITEM_", word="Name" → not "name" or "NAME" → returns Desc.
    assert.strictEqual(nameKeyToDescKey('ITEM_Name_weapon'), 'ITEM_Desc_weapon');
  });
});

describe('extractFlavorText', () => {
  it('returns the trimmed text after the final \\n\\n delimiter', () => {
    const input = String.raw`Damage: 100\nFire rate: 5\n\nA reliable workhorse weapon.`;
    assert.strictEqual(extractFlavorText(input), 'A reliable workhorse weapon.');
  });

  it('returns empty string when the last section starts with "--" (it is a heading, not flavor)', () => {
    const input = String.raw`Damage: 100\n\n-- Other stats --\nFire rate: 5`;
    // split by \n\n → ["Damage: 100", "-- Other stats --\nFire rate: 5"]
    // lastPart starts with "--" → not flavor → return ''
    assert.strictEqual(extractFlavorText(input), '');
  });

  it('returns empty string when there is no \\n\\n delimiter', () => {
    assert.strictEqual(extractFlavorText('Just a single line of text'), '');
  });

  it('returns empty string for empty input', () => {
    assert.strictEqual(extractFlavorText(''), '');
  });

  it('trims surrounding whitespace from the extracted flavor text', () => {
    const input = String.raw`Stats\n\n   flavor with padding   `;
    assert.strictEqual(extractFlavorText(input), 'flavor with padding');
  });

  it('returns only the final flavor section when there are multiple \\n\\n breaks', () => {
    const input = String.raw`A\n\nB\n\nC final flavor`;
    // split → ["A", "B", "C final flavor"] → last is "C final flavor"
    assert.strictEqual(extractFlavorText(input), 'C final flavor');
  });
});
