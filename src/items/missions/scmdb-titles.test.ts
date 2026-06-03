import assert from 'node:assert';
import { describe, it } from 'node:test';
import config from './scmdb-titles';

const { buildValue, getTargetKeys } = config;
assert.ok(buildValue, 'buildValue must be defined on the SCMDB mission titles config');
assert.ok(getTargetKeys, 'getTargetKeys must be defined on the SCMDB mission titles config');

describe('SCMDB mission titles buildValue', () => {
  it('targets only title localization keys', () => {
    assert.deepStrictEqual(getTargetKeys({ 'Localization Key': 'mission_title' }), ['mission_title']);
    assert.deepStrictEqual(getTargetKeys({ 'Localization Key': 'mission_desc' }), []);
  });

  it('appends intro and blueprint tags in stable order', () => {
    const result = buildValue(
      { Description: 'Opening Contract', TitleNote: ' <EM4>[Intro]</EM4> <EM4>[BP]</EM4>' },
      '',
      '',
      'mission_title',
    );

    assert.strictEqual(result, 'Opening Contract <EM4>[Intro]</EM4> <EM4>[BP]</EM4>');
  });

  it('strips generated title tags before rebuilding', () => {
    const oldValue = 'Opening Contract <EM4>[BP Chain]</EM4> <EM4>[Intro]</EM4>';
    const result = buildValue(
      { Description: 'unused', TitleNote: ' <EM4>[Intro]</EM4> <EM4>[BP]</EM4>' },
      '',
      oldValue,
      'mission_title',
    );

    assert.strictEqual(result, 'Opening Contract <EM4>[Intro]</EM4> <EM4>[BP]</EM4>');
  });

  it('normalizes trailing title whitespace before appending generated tags', () => {
    const result = buildValue(
      { Description: 'unused', TitleNote: ' <EM4>[BP]</EM4>' },
      '',
      'Opening Contract  ',
      'mission_title',
    );

    assert.strictEqual(result, 'Opening Contract <EM4>[BP]</EM4>');
  });
});
