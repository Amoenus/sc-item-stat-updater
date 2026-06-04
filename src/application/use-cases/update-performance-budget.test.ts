import assert from 'node:assert/strict';
import test from 'node:test';
import type { ItemConfig } from '../../enrichment/item-config';
import { applyPatchPlanToIniLines } from '../../localization/patch-application';
import { buildUpdatePlan } from './update-planning';

const ROW_COUNT = 2500;
const PLANNING_BUDGET_MS = 5000;
const APPLICATION_BUDGET_MS = 3000;

const config: ItemConfig = {
  label: 'performance-fixture-items',
  requiredColumns: ['Localization Key', 'Stat'],
  descKeyMatch: (key) => key.startsWith('item_desc_perf_'),
  buildValue: (row) => `Generated stat: ${row.Stat}`,
};

function paddedIndex(index: number): string {
  return String(index).padStart(5, '0');
}

function makeLargeFixture(): {
  rows: Record<string, string>[];
  lines: string[];
  existingKeys: Record<string, number>;
  lowerCaseIndex: Map<string, string>;
  allOccurrences: Map<string, number[]>;
} {
  const rows: Record<string, string>[] = [];
  const lines: string[] = [];
  const existingKeys: Record<string, number> = {};
  const lowerCaseIndex = new Map<string, string>();
  const allOccurrences = new Map<string, number[]>();

  for (let i = 0; i < ROW_COUNT; i++) {
    const suffix = paddedIndex(i);
    const nameKey = `item_name_perf_${suffix}`;
    const descKey = `item_desc_perf_${suffix}`;
    const baseIndex = lines.length;

    rows.push({ 'Localization Key': nameKey, Stat: `${i}` });
    lines.push(`${descKey}=old base ${i}`);
    lines.push(`${descKey},P=old plural ${i}`);

    existingKeys[descKey] = baseIndex;
    lowerCaseIndex.set(descKey.toLowerCase(), descKey);
    allOccurrences.set(descKey, [baseIndex, baseIndex + 1]);
  }

  return { rows, lines, existingKeys, lowerCaseIndex, allOccurrences };
}

test('large fixture planning and application stay within a loose performance budget', () => {
  const fixture = makeLargeFixture();

  const planningStart = performance.now();
  const planResult = buildUpdatePlan(config, fixture.rows, fixture);
  const planningMs = performance.now() - planningStart;

  const applicationStart = performance.now();
  const applicationResult = applyPatchPlanToIniLines(fixture.lines, fixture.existingKeys, planResult.plan);
  const applicationMs = performance.now() - applicationStart;

  console.log(
    `Large fixture performance: planning=${planningMs.toFixed(1)}ms application=${applicationMs.toFixed(1)}ms rows=${ROW_COUNT} patches=${planResult.plan.entries.length}`,
  );

  assert.equal(planResult.updatedCount, ROW_COUNT);
  assert.equal(planResult.plan.entries.length, ROW_COUNT * 2);
  assert.equal(applicationResult.appliedCount, ROW_COUNT * 2);
  assert.equal(applicationResult.lines[0], 'item_desc_perf_00000=Generated stat: 0');
  assert.equal(applicationResult.lines[1], 'item_desc_perf_00000,P=Generated stat: 0');
  assert.equal(applicationResult.lines.at(-1), `item_desc_perf_${paddedIndex(ROW_COUNT - 1)},P=Generated stat: ${ROW_COUNT - 1}`);
  assert.ok(
    planningMs < PLANNING_BUDGET_MS,
    `Planning took ${planningMs.toFixed(1)}ms, budget is ${PLANNING_BUDGET_MS}ms`,
  );
  assert.ok(
    applicationMs < APPLICATION_BUDGET_MS,
    `Application took ${applicationMs.toFixed(1)}ms, budget is ${APPLICATION_BUDGET_MS}ms`,
  );
});
