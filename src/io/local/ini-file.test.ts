import assert from 'node:assert';
import { describe, it } from 'node:test';
import { findIniKey } from './ini-file';

describe('findIniKey', () => {
  const index: Record<string, number> = {
    Alpha_Key: 0,
    Beta_Key: 1,
    Gamma_Key: 2,
  };
  const lowerCaseIndex = new Map<string, string>(Object.keys(index).map((k) => [k.toLowerCase(), k]));

  it('returns the key for an exact case match', () => {
    assert.strictEqual(findIniKey(index, lowerCaseIndex, 'Alpha_Key'), 'Alpha_Key');
  });

  it('returns the canonical key for a case-insensitive match (lookup miss)', () => {
    assert.strictEqual(findIniKey(index, lowerCaseIndex, 'alpha_key'), 'Alpha_Key');
    assert.strictEqual(findIniKey(index, lowerCaseIndex, 'BETA_KEY'), 'Beta_Key');
    assert.strictEqual(findIniKey(index, lowerCaseIndex, 'gamma_KEY'), 'Gamma_Key');
  });

  it('returns undefined when the key does not exist', () => {
    assert.strictEqual(findIniKey(index, lowerCaseIndex, 'nonexistent'), undefined);
  });

  it('prefers exact match over case-insensitive match', () => {
    const mixedIndex: Record<string, number> = { MyKey: 0, mykey: 1 };
    const mixedLower = new Map<string, string>(Object.keys(mixedIndex).map((k) => [k.toLowerCase(), k]));
    // Exact match wins immediately
    assert.strictEqual(findIniKey(mixedIndex, mixedLower, 'MyKey'), 'MyKey');
    assert.strictEqual(findIniKey(mixedIndex, mixedLower, 'mykey'), 'mykey');
  });

  it('returns undefined for an empty index', () => {
    assert.strictEqual(findIniKey({}, new Map(), 'any_key'), undefined);
  });
});
