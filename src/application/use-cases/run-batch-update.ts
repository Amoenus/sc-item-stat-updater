import path from 'node:path';
import { backupIniFile } from '../../localization/ini-file';
import { DATACORE_RAW_FACTS } from './category-listing';
import {
  type PreparedUpdateCategories,
  prepareUpdateCategories,
  type UpdateCategory,
  type UpdateProvider,
} from './prepare-update-categories';
import {
  type BatchUpdateError,
  type BatchUpdateResult,
  runPreparedUpdateCategories,
} from './run-prepared-update-categories';
import { getUpdateExtraStepLabels, runUpdateExtraSteps, type UpdateExtraStepLabel } from './run-update-extra-steps';
import { buildScmdbDependencyAudit, type ScmdbDependencyAudit } from './scmdb-dependency-audit';
import { buildSourceFreshnessDiagnostics, type SourceFreshnessDiagnostics } from './source-freshness-diagnostics';
import { preflightCheckConfigs } from './update-planning';

export interface RunBatchUpdateOptions {
  repoRoot: string;
  iniPath?: string;
  csvDir?: string;
  dryRun?: boolean;
  ptu?: boolean;
  provider?: UpdateProvider;
  includeMiningJournal?: boolean;
  skipBackup?: boolean;
  prepare?: typeof prepareUpdateCategories;
  preflight?: typeof preflightCheckConfigs;
  backupIni?: typeof backupIniFile;
  runCategories?: typeof runPreparedUpdateCategories;
  runExtraSteps?: typeof runUpdateExtraSteps;
  sourceDiagnostics?: typeof buildSourceFreshnessDiagnostics;
  scmdbDependencyAudit?: typeof buildScmdbDependencyAudit;
  now?: () => number;
  onCategoryStart?: (category: UpdateCategory, index: number) => void;
  onCategoryError?: (error: BatchUpdateError) => void;
  onExtraStepStart?: (label: UpdateExtraStepLabel, index: number) => void;
  onExtraStepError?: (error: BatchUpdateError) => void;
}

export interface RunBatchUpdateResult {
  exitCode: number;
  results: BatchUpdateResult[];
  errors: BatchUpdateError[];
  prepared: PreparedUpdateCategories;
  sourceDiagnostics: SourceFreshnessDiagnostics;
  scmdbDependencyAudit?: ScmdbDependencyAudit;
  iniPath: string;
  totalDurationMs: number;
}

export async function runBatchUpdate(options: RunBatchUpdateOptions): Promise<RunBatchUpdateResult> {
  const provider = options.provider ?? 'datacore';
  const dryRun = options.dryRun ?? false;
  const iniPath = options.iniPath || path.join(options.repoRoot, 'global.ini');
  const now = options.now ?? (() => performance.now());
  const prepare = options.prepare ?? prepareUpdateCategories;
  const preflight = options.preflight ?? preflightCheckConfigs;
  const backupIni = options.backupIni ?? backupIniFile;
  const runCategories = options.runCategories ?? runPreparedUpdateCategories;
  const runExtraSteps = options.runExtraSteps ?? runUpdateExtraSteps;
  const sourceDiagnostics = options.sourceDiagnostics ?? buildSourceFreshnessDiagnostics;
  const buildScmdbAudit = options.scmdbDependencyAudit ?? buildScmdbDependencyAudit;

  const prepared = await prepare({
    repoRoot: options.repoRoot,
    provider,
    ptu: options.ptu,
    csvDir: options.csvDir,
  });

  const diagnostics = await sourceDiagnostics(prepared, { provider, ptu: options.ptu });
  const scmdbDependencyAudit = await buildScmdbAudit({ provider });

  await preflight(prepared.categories, {
    rawFacts: DATACORE_RAW_FACTS.map((rawFact) => ({
      rawFact,
      baseDir: prepared.itemVersionDir,
      channel: options.ptu ? ('PTU' as const) : ('LIVE' as const),
    })),
  });

  if (!dryRun && !options.skipBackup) {
    await backupIni(iniPath);
  }

  const totalStart = now();
  const categoryResult = await runCategories(prepared.categories, {
    iniPath,
    dryRun,
    skipBackup: true,
    onCategoryStart: options.onCategoryStart,
    onCategoryError: options.onCategoryError,
  });

  const extraStepResult = await runExtraSteps({
    iniPath,
    repoRoot: options.repoRoot,
    missionCsvDir: prepared.missionCsvDir,
    datacoreVersionDir: prepared.itemVersionDir,
    dryRun,
    includeMiningJournal: options.includeMiningJournal,
    onStepStart: options.onExtraStepStart,
    onStepError: options.onExtraStepError,
  });

  const results = [...categoryResult.results, ...extraStepResult.results];
  const errors = [...categoryResult.errors, ...extraStepResult.errors];

  return {
    exitCode: errors.length > 0 ? 1 : 0,
    results,
    errors,
    prepared,
    sourceDiagnostics: diagnostics,
    scmdbDependencyAudit,
    iniPath,
    totalDurationMs: Math.round(now() - totalStart),
  };
}

export function getBatchUpdateStepCount(
  categoryCount: number,
  options: { includeMiningJournal?: boolean } = {},
): number {
  return categoryCount + getUpdateExtraStepLabels(options).length;
}
