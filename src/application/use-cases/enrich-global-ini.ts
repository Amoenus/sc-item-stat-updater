import fs from 'node:fs/promises';
import type { ItemConfig, ItemSourceDataContext } from '../../enrichment/item-config';
import { getLogger } from '../../infrastructure/logger';
import { writeIniFile } from '../../localization/ini-file';
import { applyPatchPlanToIniLines } from '../../localization/patch-application';
import type { PatchPlan } from '../../pipeline/types';
import { resolveOptions, type UpdatePlanResult, validateIntegrity } from '../update/update-planning';
import { buildPatchPlanResult } from './build-patch-plan';

export interface EnrichGlobalIniOptions {
  iniPath?: string;
  csvDir?: string;
  sourceDirs?: ItemSourceDataContext['sourceDirs'];
  dryRun?: boolean;
  skipBackup?: boolean;
  force?: boolean;
  legacyKeyResolution?: boolean;
}

export interface EnrichGlobalIniResult {
  label: string;
  updatedCount: number;
  newCount: number;
  skippedCount: number;
  foundCount: number;
  errorCount: number;
  unresolvedCount: number;
  issues: UpdatePlanResult['issues'];
  patches: Record<string, string>;
  newLines: string[];
  plan: PatchPlan;
  summary: string;
}

const logger = getLogger('enrich-global-ini');

function shouldWriteIni(
  opts: ReturnType<typeof resolveOptions>,
  planResult: Pick<UpdatePlanResult, 'updatedCount' | 'newCount'>,
): boolean {
  if (opts.dryRun) return false;
  if (opts.force) return true;
  return planResult.updatedCount > 0 || planResult.newCount > 0;
}

function buildEnrichResult(
  planResult: UpdatePlanResult,
  patches: Record<string, string>,
  dryRun: boolean,
  durationMs: number,
): EnrichGlobalIniResult {
  const suffix = dryRun ? ' (dry run)' : '';
  const errorSuffix = planResult.errorCount > 0 ? `, Errors ${planResult.errorCount}` : '';
  const unresolvedSuffix = planResult.unresolvedCount > 0 ? `, Unresolved ${planResult.unresolvedCount}` : '';
  const foundSuffix = planResult.foundCount > 0 ? `, Found ${planResult.foundCount}` : '';
  const summary = `${planResult.label}: Updated ${planResult.updatedCount}, Added ${planResult.newCount}${foundSuffix}, Skipped ${planResult.skippedCount}${errorSuffix}${unresolvedSuffix}${suffix} [${durationMs}ms]`;

  const stats = {
    updatedCount: planResult.updatedCount,
    newCount: planResult.newCount,
    skippedCount: planResult.skippedCount,
    foundCount: planResult.foundCount,
    errorCount: planResult.errorCount,
    unresolvedCount: planResult.unresolvedCount,
    issues: planResult.issues,
  };

  logger.debug(summary, {
    label: planResult.label,
    durationMs,
    dryRun,
    ...stats,
    issues: planResult.issues.length,
  });

  return {
    label: planResult.label,
    ...stats,
    patches,
    newLines: planResult.newLines,
    plan: planResult.plan,
    summary,
  };
}

export async function enrichGlobalIni(
  config: ItemConfig,
  options: EnrichGlobalIniOptions = {},
): Promise<EnrichGlobalIniResult> {
  const start = performance.now();
  const opts = resolveOptions(options);

  try {
    await fs.access(opts.iniPath);
  } catch {
    throw new Error(`INI file not found: ${opts.iniPath}`);
  }

  try {
    const planResult = await buildPatchPlanResult(config, options);
    const application = applyPatchPlanToIniLines(planResult.iniLines, planResult.iniIndex, planResult.plan, {
      insertionIndex: planResult.insertionIndex,
    });

    validateIntegrity(planResult.iniLines.length, application.lines);

    if (shouldWriteIni(opts, planResult)) {
      await writeIniFile(opts.iniPath, application.lines, { skipBackup: opts.skipBackup });
    }

    const durationMs = Math.round(performance.now() - start);
    return buildEnrichResult(planResult, application.patches, opts.dryRun, durationMs);
  } catch (err) {
    throw new Error(`Failed to update ${config.label}: ${(err as Error).message}`, { cause: err });
  }
}
