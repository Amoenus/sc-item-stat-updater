import path from 'node:path';
import { backupIniFile } from '../../localization/ini-file';
import { DATACORE_RAW_FACTS } from '../catalog/category-listing';
import { buildScmdbDependencyAudit, type ScmdbDependencyAudit } from '../diagnostics/scmdb-dependency-audit';
import {
  buildSourceFreshnessDiagnostics,
  type SourceFreshnessDiagnostics,
} from '../diagnostics/source-freshness-diagnostics';
import { preflightCheckConfigs } from '../update/update-planning';
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
import {
  createUpdateExtraStepRunners,
  getUpdateExtraStepLabels,
  runUpdateExtraSteps,
  type UpdateExtraStepLabel,
} from './run-update-extra-steps';

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

export interface BatchUpdatePlan {
  prepare(): Promise<PreparedUpdateCategories>;
  preflight(): Promise<void>;
  backup(): Promise<void>;
  runCategory(category: UpdateCategory, index: number): Promise<BatchUpdateResult | undefined>;
  getExtraStepLabels(): UpdateExtraStepLabel[];
  runExtraStep(label: UpdateExtraStepLabel, index: number): Promise<BatchUpdateResult | undefined>;
  runAllExtraSteps(): Promise<void>;
  result(): RunBatchUpdateResult;
}

export function createBatchUpdatePlan(options: RunBatchUpdateOptions): BatchUpdatePlan {
  const provider = options.provider ?? 'datacore';
  const dryRun = options.dryRun ?? false;
  const iniPath = options.iniPath || path.join(options.repoRoot, 'global.ini');
  const now = options.now ?? (() => performance.now());
  const prepare = options.prepare ?? prepareUpdateCategories;
  const preflight = options.preflight ?? preflightCheckConfigs;
  const backupIni = options.backupIni ?? backupIniFile;
  const runCategories = options.runCategories ?? runPreparedUpdateCategories;
  const sourceDiagnostics = options.sourceDiagnostics ?? buildSourceFreshnessDiagnostics;
  const buildScmdbAudit = options.scmdbDependencyAudit ?? buildScmdbDependencyAudit;
  const runExtraSteps = options.runExtraSteps ?? runUpdateExtraSteps;
  let prepared: PreparedUpdateCategories | undefined;
  let diagnostics: SourceFreshnessDiagnostics | undefined;
  let scmdbDependencyAudit: ScmdbDependencyAudit | undefined;
  const results: BatchUpdateResult[] = [];
  const errors: BatchUpdateError[] = [];
  let totalStart: number | undefined;
  let totalDurationMs = 0;

  function requirePrepared(): PreparedUpdateCategories {
    if (!prepared) throw new Error('Batch update plan has not been prepared.');
    return prepared;
  }

  function startTimer(): void {
    totalStart ??= now();
  }

  return {
    async prepare() {
      if (prepared) return prepared;

      prepared = await prepare({
        repoRoot: options.repoRoot,
        provider,
        ptu: options.ptu,
        csvDir: options.csvDir,
      });

      diagnostics = await sourceDiagnostics(prepared, { provider, ptu: options.ptu });
      scmdbDependencyAudit = await buildScmdbAudit({ provider });
      return prepared;
    },

    async preflight() {
      const state = requirePrepared();
      await preflight(state.categories, {
        rawFacts: DATACORE_RAW_FACTS.map((rawFact) => ({
          rawFact,
          baseDir: state.itemVersionDir,
          channel: options.ptu ? ('PTU' as const) : ('LIVE' as const),
        })),
      });
    },

    async backup() {
      if (!dryRun && !options.skipBackup) {
        await backupIni(iniPath);
      }
    },

    async runCategory(category, index) {
      startTimer();
      options.onCategoryStart?.(category, index);
      const categoryResult = await runCategories([category], {
        iniPath,
        dryRun,
        skipBackup: true,
        onCategoryError: options.onCategoryError,
      });
      results.push(...categoryResult.results);
      errors.push(...categoryResult.errors);
      return categoryResult.results[0];
    },

    getExtraStepLabels() {
      return getUpdateExtraStepLabels({ includeMiningJournal: options.includeMiningJournal });
    },

    async runExtraStep(label, index) {
      const state = requirePrepared();
      startTimer();
      options.onExtraStepStart?.(label, index);

      if (runExtraSteps !== runUpdateExtraSteps) {
        throw new Error('Custom extra step runners must be invoked with runAllExtraSteps().');
      }

      const runners = createUpdateExtraStepRunners({
        iniPath,
        repoRoot: options.repoRoot,
        missionCsvDir: state.missionCsvDir,
        datacoreVersionDir: state.itemVersionDir,
        scmdbDir: state.scmdbDir,
        dryRun,
        includeMiningJournal: options.includeMiningJournal,
      });

      try {
        const result = await runners[label]?.();
        if (result != null) {
          results.push(result);
          return result;
        }
      } catch (err) {
        const error = toBatchUpdateError(label, err);
        errors.push(error);
        options.onExtraStepError?.(error);
      }
      return undefined;
    },

    async runAllExtraSteps() {
      const state = requirePrepared();
      startTimer();

      if (runExtraSteps !== runUpdateExtraSteps) {
        const extraStepResult = await runExtraSteps({
          iniPath,
          repoRoot: options.repoRoot,
          missionCsvDir: state.missionCsvDir,
          datacoreVersionDir: state.itemVersionDir,
          scmdbDir: state.scmdbDir,
          dryRun,
          includeMiningJournal: options.includeMiningJournal,
          onStepStart: options.onExtraStepStart,
          onStepError: options.onExtraStepError,
        });
        results.push(...extraStepResult.results);
        errors.push(...extraStepResult.errors);
        return;
      }

      const labels = this.getExtraStepLabels();
      for (let index = 0; index < labels.length; index++) {
        await this.runExtraStep(labels[index], index);
      }
    },

    result() {
      const state = requirePrepared();
      totalDurationMs = totalStart === undefined ? 0 : Math.round(now() - totalStart);
      return {
        exitCode: errors.length > 0 ? 1 : 0,
        results,
        errors,
        prepared: state,
        sourceDiagnostics: diagnostics ?? { versions: [], warnings: [] },
        scmdbDependencyAudit,
        iniPath,
        totalDurationMs,
      };
    },
  };
}

export async function runBatchUpdate(options: RunBatchUpdateOptions): Promise<RunBatchUpdateResult> {
  const plan = createBatchUpdatePlan(options);
  const prepared = await plan.prepare();
  await plan.preflight();
  await plan.backup();

  for (let index = 0; index < prepared.categories.length; index++) {
    await plan.runCategory(prepared.categories[index], index);
  }

  await plan.runAllExtraSteps();

  return plan.result();
}

export function getBatchUpdateStepCount(
  categoryCount: number,
  options: { includeMiningJournal?: boolean } = {},
): number {
  return categoryCount + getUpdateExtraStepLabels(options).length;
}

function toBatchUpdateError(label: UpdateExtraStepLabel, err: unknown): BatchUpdateError {
  const error = err instanceof Error ? err : new Error(String(err));
  const cause = error.cause instanceof Error ? error.cause.message : undefined;
  return {
    label,
    message: error.message,
    cause,
  };
}
