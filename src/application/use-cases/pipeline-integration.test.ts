import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, beforeEach, test } from 'node:test';
import { loadConfig } from '../../items/registry';
import { readIniFile, writeIniFile } from '../../localization/ini-file';
import { applyPatchPlanToIniLines } from '../../localization/patch-application';
import { buildPatchPlanResult } from './build-patch-plan';

const fixtureRoot = path.resolve(import.meta.dirname, '..', '..', '..', 'test', 'fixtures', 'pipeline-integration');
const tmpDirs: string[] = [];
let tmpDir = '';

interface AppliedCategory {
  label: string;
  updatedCount: number;
  skippedCount: number;
  unresolvedCount: number;
  appliedCount: number;
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pipeline-integration-test-'));
  tmpDirs.push(tmpDir);
  await fs.cp(fixtureRoot, tmpDir, { recursive: true });
});

after(async () => {
  for (const dir of tmpDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

function stripBom(text: string): string {
  return text.codePointAt(0) === 0xfeff ? text.slice(1) : text;
}

async function applyFixtureCategory(slug: string, csvDir: string, iniPath: string): Promise<AppliedCategory> {
  const config = await loadConfig(slug);
  const planResult = await buildPatchPlanResult(config, { csvDir, iniPath, dryRun: true });
  const application = applyPatchPlanToIniLines(planResult.iniLines, planResult.iniIndex, planResult.plan, {
    insertionIndex: planResult.insertionIndex,
  });
  await writeIniFile(iniPath, application.lines, { skipBackup: true });

  return {
    label: planResult.label,
    updatedCount: planResult.updatedCount,
    skippedCount: planResult.skippedCount,
    unresolvedCount: planResult.unresolvedCount,
    appliedCount: application.appliedCount,
  };
}

test('fixture pipeline updates SPViewer and DataCore category output without touching unrelated INI keys', async () => {
  const csvDir = path.join(tmpDir, 'csv');
  const iniPath = path.join(tmpDir, 'global.ini');
  const before = stripBom(await fs.readFile(iniPath, 'utf-8'));

  const results = [
    await applyFixtureCategory('sp-coolers', csvDir, iniPath),
    await applyFixtureCategory('dc-powerplants', csvDir, iniPath),
  ];
  const afterText = stripBom(await fs.readFile(iniPath, 'utf-8'));
  const { index, lines } = await readIniFile(iniPath);

  assert.deepEqual(results, [
    { label: 'SP Coolers', updatedCount: 3, skippedCount: 0, unresolvedCount: 0, appliedCount: 3 },
    { label: 'DC Power Plants', updatedCount: 3, skippedCount: 0, unresolvedCount: 0, appliedCount: 3 },
  ]);

  assert.equal(
    lines[index.item_Desc_COOL_ACOM_S01_ICEPLUNGE],
    String.raw`item_Desc_COOL_ACOM_S01_ICEPLUNGE=Item Type: Cooler\nManufacturer: ACOM\nSize: 1\nGrade: A\nClass: Competition\n\n-- Cooling Stats --\nCooling Generation: 34\n\n-- Emission --\nEM Max: 12\nIR: 8\n\n-- Power --\nPower Max: 18\nPower Min: 3\n\n-- Durability --\nHealth: 69\nDistortion Shutdown: 22\n\nKeep chill.`,
  );
  assert.equal(
    lines[index.item_DescPOWR_AMRS_S1_HEARTBEAT],
    String.raw`item_DescPOWR_AMRS_S1_HEARTBEAT=Item Type: Power Plant\nManufacturer: AMRS\nSize: 1\nGrade: B\nClass: Military\n\n-- Power Stats --\nPower Output: 3100\n\n-- Emission --\nEM Per Segment: 17\n\n-- Durability --\nHealth: 150`,
  );

  assert.match(afterText, /item_Desc_COOL_ACOM_S02_WINTERSTAR=Item Type: Cooler/);
  assert.match(afterText, /item_DescPOWR_AEGS_S2_SUNFLARE=Item Type: Power Plant/);
  assert.match(afterText, /item_DescPOWR_TARS_S1_NIGHTFALL=Item Type: Power Plant/);
  assert.match(afterText, /item_Desc_MISC_UNRELATED=Do not change this description\./);
  assert.match(afterText, /mission_Desc_intro=Leave mission text alone\./);
  assert.match(before, /item_Desc_MISC_UNRELATED=Do not change this description\./);
});
