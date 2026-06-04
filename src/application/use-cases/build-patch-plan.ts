import type { ItemConfig } from '../../lib/types';
import {
  buildUpdatePlan,
  findLastDescIndex,
  loadSourceData,
  resolveOptions,
  resolveSpviewerKeys,
  type UpdateOptions,
  type UpdatePlanResult,
} from '../../lib/updater';
import type { PatchPlan } from '../../pipeline/types';
import { readIniFile } from '../../io/local/ini-file';

export type BuildPatchPlanOptions = Pick<UpdateOptions, 'iniPath' | 'csvDir' | 'dryRun' | 'force'>;

export interface BuildPatchPlanResult extends UpdatePlanResult {
  insertionIndex: number;
}

export async function buildPatchPlanResult(
  config: ItemConfig,
  options: BuildPatchPlanOptions = {},
): Promise<BuildPatchPlanResult> {
  const opts = resolveOptions({ ...options, dryRun: options.dryRun ?? true });
  const rows = await loadSourceData(config, opts.csvDir);
  const { lines, index: existingKeys, lowerCaseIndex, allOccurrences } = await readIniFile(opts.iniPath);

  let resolvedRows = rows;
  let unresolvedNames: string[] = [];
  if (config.nameColumn) {
    const result = await resolveSpviewerKeys(rows, config, lines, opts.csvDir, opts.baseDir, opts.dryRun);
    resolvedRows = result.resolvedRows;
    unresolvedNames = result.unresolved;
  }

  const insertionIndex = findLastDescIndex(existingKeys, lowerCaseIndex, config.descKeyMatch);
  const planResult = buildUpdatePlan(
    config,
    resolvedRows,
    { lines, existingKeys, lowerCaseIndex, allOccurrences },
    unresolvedNames,
    opts.force,
  );

  return { ...planResult, insertionIndex };
}

export async function buildPatchPlan(config: ItemConfig, options: BuildPatchPlanOptions = {}): Promise<PatchPlan> {
  const result = await buildPatchPlanResult(config, options);
  return result.plan;
}
