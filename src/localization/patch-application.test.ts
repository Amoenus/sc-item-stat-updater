import assert from 'node:assert';
import { describe, it } from 'node:test';
import { applyLocalizationLinePatch, applyPatchPlanToIniLines } from './patch-application';
import type { PatchPlan } from '../pipeline/types';

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
    const plan: PatchPlan = {
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
});
