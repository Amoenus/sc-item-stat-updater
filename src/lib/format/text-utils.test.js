import assert from 'node:assert';
import test from 'node:test';
import { appendMissingPlaceholders, extractPlaceholders } from './text-utils.js';

test('text-utils: extractPlaceholders', async (t) => {
  await t.test('should extract percent placeholders', () => {
    const placeholders = extractPlaceholders('Test %name and %other');
    assert.deepStrictEqual(placeholders, ['%name', '%other']);
  });

  await t.test('should extract tilde placeholders', () => {
    const placeholders = extractPlaceholders('Test ~mission(Destination|Address) and ~some(param)');
    assert.deepStrictEqual(placeholders, ['~mission(Destination|Address)', '~some(param)']);
  });

  await t.test('should extract both percent and tilde placeholders', () => {
    const placeholders = extractPlaceholders('Test %name with ~mission(Destination|Address)');
    assert.deepStrictEqual(placeholders, ['~mission(Destination|Address)', '%name']);
  });

  await t.test('should return empty array for strings without placeholders', () => {
    const placeholders = extractPlaceholders('No placeholders here');
    assert.deepStrictEqual(placeholders, []);
  });

  await t.test('should handle empty or null values', () => {
    assert.deepStrictEqual(extractPlaceholders(''), []);
    assert.deepStrictEqual(extractPlaceholders(null), []);
    assert.deepStrictEqual(extractPlaceholders(undefined), []);
  });
});

test('text-utils: appendMissingPlaceholders', async (t) => {
  await t.test('should append missing placeholders', () => {
    const result = appendMissingPlaceholders('Old %name %missing', 'New %name');
    assert.strictEqual(result, 'New %name %missing');
  });

  await t.test('should not append placeholders that are already present', () => {
    const result = appendMissingPlaceholders('Old %name', 'New %name');
    assert.strictEqual(result, 'New %name');
  });

  await t.test('should handle no placeholders in oldValue', () => {
    const result = appendMissingPlaceholders('Old text', 'New %name');
    assert.strictEqual(result, 'New %name');
  });

  await t.test('should append multiple missing placeholders', () => {
    const result = appendMissingPlaceholders('Old %name ~mission(Destination|Address)', 'New text');
    assert.strictEqual(result, 'New text ~mission(Destination|Address) %name');
  });
});
