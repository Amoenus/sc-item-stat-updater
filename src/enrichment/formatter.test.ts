import assert from 'node:assert';
import { describe, it } from 'node:test';
import { fmtNum, sanitizeIniValue } from './formatter';

describe('fmtNum: falsy / nullish input', () => {
  it('returns "0" for undefined', () => {
    assert.strictEqual(fmtNum(undefined), '0');
  });

  it('returns "0" for null', () => {
    assert.strictEqual(fmtNum(null), '0');
  });

  it('returns "0" for the empty string', () => {
    assert.strictEqual(fmtNum(''), '0');
  });

  it('returns "0" for false', () => {
    assert.strictEqual(fmtNum(false), '0');
  });

  it('returns "0" for the number 0 (special-cased, not treated as falsy)', () => {
    assert.strictEqual(fmtNum(0), '0');
  });

  it('returns "0" for the string "0"', () => {
    assert.strictEqual(fmtNum('0'), '0');
  });
});

describe('fmtNum: numeric formatting', () => {
  it('formats an integer string with thousands separators', () => {
    assert.strictEqual(fmtNum('1234'), '1,234');
  });

  it('formats a float string with thousands separators and decimals', () => {
    assert.strictEqual(fmtNum('1234.5'), '1,234.5');
  });

  it('formats a number primitive', () => {
    assert.strictEqual(fmtNum(1234567), '1,234,567');
  });

  it('strips existing commas before parsing, then re-formats', () => {
    assert.strictEqual(fmtNum('1,000,000'), '1,000,000');
  });

  it('trims surrounding ASCII whitespace before parsing', () => {
    assert.strictEqual(fmtNum('  500  '), '500');
  });

  it('formats negative numbers', () => {
    assert.strictEqual(fmtNum('-1500'), '-1,500');
  });
});

describe('fmtNum: Unicode space handling', () => {
  it('strips a non-breaking space (U+00A0) before parsing', () => {
    assert.strictEqual(fmtNum('1 000'), '1,000');
  });

  it('strips a narrow no-break space (U+202F) before parsing', () => {
    assert.strictEqual(fmtNum('1 000'), '1,000');
  });

  it('strips a zero-width space (U+200B) before parsing', () => {
    assert.strictEqual(fmtNum('1​000'), '1,000');
  });

  it('strips an em space (U+2003) before parsing', () => {
    assert.strictEqual(fmtNum('2 500'), '2,500');
  });

  it('strips a word-joiner (U+2060) before parsing', () => {
    assert.strictEqual(fmtNum('3⁠000'), '3,000');
  });

  it('strips an ideographic space (U+3000) before parsing', () => {
    assert.strictEqual(fmtNum('　1000　'), '1,000');
  });
});

describe('fmtNum: non-numeric input', () => {
  it('returns the trimmed input when the value cannot be parsed', () => {
    assert.strictEqual(fmtNum('not a number'), 'not a number');
  });

  it('replaces Unicode spaces with a regular space in the fallback (NaN) path', () => {
    assert.strictEqual(fmtNum('hello world'), 'hello world');
  });

  it('trims surrounding whitespace in the fallback (NaN) path', () => {
    assert.strictEqual(fmtNum('   text   '), 'text');
  });
});

describe('fmtNum: object input', () => {
  it('JSON-stringifies non-string, non-nullish values before parsing', () => {
    assert.strictEqual(fmtNum({ a: 1 }), '{"a":1}');
  });

  it('handles arrays via JSON.stringify in the fallback path', () => {
    // JSON.stringify([1, 2]) === "[1,2]" → not a number → fallback returns trimmed raw
    assert.strictEqual(fmtNum([1, 2]), '[1,2]');
  });

  it('treats a single-element array as a parseable numeric string', () => {
    // JSON.stringify([42]) === "[42]" — Number.parseFloat("[42]") is NaN, so
    // the fallback returns the raw stringified form.
    assert.strictEqual(fmtNum([42]), '[42]');
  });
});

describe('sanitizeIniValue', () => {
  it('strips raw newlines', () => {
    assert.strictEqual(sanitizeIniValue('line1\nline2'), 'line1line2');
  });

  it('strips carriage returns', () => {
    assert.strictEqual(sanitizeIniValue('line1\r\nline2'), 'line1line2');
  });

  it('strips low control characters but preserves tabs (\\x09)', () => {
    assert.strictEqual(sanitizeIniValue('a\x00b\x01c\tdone'), 'abc\tdone');
  });

  it('strips DEL-adjacent control range \\x0e-\\x1f', () => {
    assert.strictEqual(sanitizeIniValue('a\x1fb'), 'ab');
  });

  it('preserves literal "\\n" escape sequences (game engine markers)', () => {
    assert.strictEqual(sanitizeIniValue(String.raw`stat1\nstat2`), String.raw`stat1\nstat2`);
  });

  it('replaces Unicode spaces with a regular space', () => {
    assert.strictEqual(sanitizeIniValue('a b c'), 'a b c');
  });

  it('coerces non-string input via String()', () => {
    assert.strictEqual(sanitizeIniValue(42), '42');
    assert.strictEqual(sanitizeIniValue(null), 'null');
    assert.strictEqual(sanitizeIniValue(undefined), 'undefined');
  });
});
