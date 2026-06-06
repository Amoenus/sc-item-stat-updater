import assert from 'node:assert';
import { describe, it } from 'node:test';
import type { PatchPlan } from '../pipeline/types';
import type { LocalizationPatchPlan } from './patch-application';
import { applyLocalizationLinePatch, applyPatchPlanToIniLines } from './patch-application';

describe('localization: patch application', () => {
  it('updates an existing INI line while preserving the actual line key suffix', () => {
    const lines = ['item_desc,P=old'];
    const patches: Record<string, string> = {};

    applyLocalizationLinePatch(lines, 0, lines[0], 'item_desc', 'new', patches);

    assert.deepStrictEqual(lines, ['item_desc,P=new']);
    assert.deepStrictEqual(patches, { item_desc: 'new' });
  });

  it('applies a patch plan to INI lines without mutating the input array', () => {
    const lines = ['b_desc=old b', 'a_desc=old a'];
    const plan: PatchPlan = {
      entries: [
        { key: 'a_desc', value: 'new a', source: 'test', reason: 'fixture' },
        { key: 'missing_desc', value: 'new missing', source: 'test', reason: 'fixture' },
      ],
      issues: [],
    };

    const result = applyPatchPlanToIniLines(lines, { b_desc: 0, a_desc: 1 }, plan, {
      insertMissing: true,
      insertionIndex: 1,
    });

    assert.deepStrictEqual(lines, ['b_desc=old b', 'a_desc=old a']);
    assert.deepStrictEqual(result.lines, ['b_desc=old b', 'a_desc=new a', 'missing_desc=new missing']);
    assert.deepStrictEqual(result.patches, { a_desc: 'new a' });
    assert.deepStrictEqual(result.missingKeys, ['missing_desc']);
  });

  it('applies a planned entry to an explicit existing line index', () => {
    const lines = ['item_desc,P=old plural', 'item_desc=old base'];
    const plan: LocalizationPatchPlan = {
      entries: [
        {
          key: 'item_desc',
          value: 'new plural',
          source: 'test',
          reason: 'fixture',
          existingLineIndex: 0,
        },
      ],
      issues: [],
    };

    const result = applyPatchPlanToIniLines(lines, { item_desc: 1 }, plan);

    assert.deepStrictEqual(result.lines, ['item_desc,P=new plural', 'item_desc=old base']);
    assert.deepStrictEqual(result.patches, { item_desc: 'new plural' });
  });

  it('applies all duplicate and plural/gender occurrences while preserving line keys', () => {
    const lines = [
      'item_desc=old base',
      'item_desc,P=old plural',
      'item_desc,G=old gendered',
      'item_desc=old duplicate',
    ];
    const plan: LocalizationPatchPlan = {
      entries: [
        { key: 'item_desc', value: 'new shared value', source: 'test', reason: 'fixture', existingLineIndex: 0 },
        { key: 'item_desc', value: 'new shared value', source: 'test', reason: 'fixture', existingLineIndex: 1 },
        { key: 'item_desc', value: 'new shared value', source: 'test', reason: 'fixture', existingLineIndex: 2 },
        { key: 'item_desc', value: 'new shared value', source: 'test', reason: 'fixture', existingLineIndex: 3 },
      ],
      issues: [],
    };

    const result = applyPatchPlanToIniLines(lines, { item_desc: 3 }, plan);

    assert.deepStrictEqual(result.lines, [
      'item_desc=new shared value',
      'item_desc,P=new shared value',
      'item_desc,G=new shared value',
      'item_desc=new shared value',
    ]);
    assert.strictEqual(result.appliedCount, 4);
    assert.deepStrictEqual(result.missingKeys, []);
  });
});
