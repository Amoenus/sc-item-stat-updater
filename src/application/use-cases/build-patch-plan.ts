import type { ItemConfig } from '../../enrichment/item-config';
import { readIniFile } from '../../localization/ini-file';
import type { PatchPlan } from '../../pipeline/types';
import {
  buildUpdatePlan,
  findLastDescIndex,
  loadSourceData,
  resolveOptions,
  resolveSpviewerKeys,
  type UpdateOptions,
  type UpdatePlanResult,
} from '../update/update-planning';

export type BuildPatchPlanOptions = Pick<
  UpdateOptions,
  'baseDir' | 'iniPath' | 'csvDir' | 'sourceDirs' | 'dryRun' | 'force'
> & {
  legacyKeyResolution?: boolean;
};

export interface BuildPatchPlanResult extends UpdatePlanResult {
  iniLines: string[];
  iniIndex: Record<string, number>;
  insertionIndex: number;
}

export async function buildPatchPlanResult(
  config: ItemConfig,
  options: BuildPatchPlanOptions = {},
): Promise<BuildPatchPlanResult> {
  const opts = resolveOptions({ ...options, dryRun: options.dryRun ?? true });
  const rows = await loadSourceData(config, opts.csvDir, options.sourceDirs);
  const { lines, index: existingKeys, lowerCaseIndex, allOccurrences } = await readIniFile(opts.iniPath);

  let resolvedRows = rows;
  let unresolvedNames: string[] = [];
  if (config.nameColumn) {
    if (!options.legacyKeyResolution) {
      throw new Error(
        `Legacy SPViewer key resolution is disabled for "${config.label}". Pass legacyKeyResolution to opt into mapping-file based key resolution.`,
      );
    }
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

  return { ...planResult, iniLines: lines, iniIndex: existingKeys, insertionIndex };
}

export async function buildPatchPlan(config: ItemConfig, options: BuildPatchPlanOptions = {}): Promise<PatchPlan> {
  const result = await buildPatchPlanResult(config, options);
  return result.plan;
}
