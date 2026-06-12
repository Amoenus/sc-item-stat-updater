import path from 'node:path';
import { parseArgs } from 'node:util';
import { formatScmdbDependencyAudit } from '../../application/diagnostics/scmdb-dependency-audit';
import { formatSourceFreshnessDiagnostics } from '../../application/diagnostics/source-freshness-diagnostics';
import { deployGlobalIni } from '../../application/use-cases/deploy-global-ini';
import type { PreparedUpdateCategories } from '../../application/use-cases/prepare-update-categories';
import { refreshGlobalIni } from '../../application/use-cases/refresh-global-ini';
import {
  refreshSourceCache,
  type SourceCacheSource,
  type SourceCacheTarget,
} from '../../application/use-cases/refresh-source-cache';
import { createBatchUpdatePlan, runBatchUpdate } from '../../application/use-cases/run-batch-update';
import { createDataCoreScrapePlan } from '../../application/use-cases/run-datacore-scrape';
import { createScmdbScrapePlan } from '../../application/use-cases/run-scmdb-scrape';
import { type CommandIO, defaultCommandIO, isNpmConfigFlagEnabled, writeErrorLine, writeLine } from '../cli';
import { createDataCoreProgressCallbacks } from '../datacore-progress';
import { createDataCoreScrapeTask } from '../datacore-task';
import { createScmdbScrapeTask } from '../scmdb-task';
import { createIndexedTasks, createPlannedChildTaskList, runCompactTaskList } from '../task-builders';
import { type CommandTask, createCommandTaskList } from '../task-list';
import { groupUpdateCategories } from '../update-category-groups';

const ROOT_DIR = path.resolve(import.meta.dirname, '..', '..', '..');

interface PipelineCommandDependencies {
  refreshGlobalIni?: typeof refreshGlobalIni;
  refreshSourceCache?: typeof refreshSourceCache;
  createDataCoreScrapePlan?: typeof createDataCoreScrapePlan;
  createScmdbScrapePlan?: typeof createScmdbScrapePlan;
  runBatchUpdate?: typeof runBatchUpdate;
  createBatchUpdatePlan?: typeof createBatchUpdatePlan;
  deployGlobalIni?: typeof deployGlobalIni;
}

interface PipelineTaskContext {
  extractedGamePath?: string;
  repoIniPath: string;
  reports: string[];
}

function printHelp(io: CommandIO): void {
  writeLine(
    io,
    `Usage: node --import tsx/esm bin/pipeline.ts [options]

Options:
  --cached       Use existing source outputs instead of refreshing SCMDB/DataCore
  --repo-only    Update repo global.ini without deploying back to the game directory
  --rebuild-cache  Rebuild expensive DataCore DCB/XML caches during source refresh
  --dry-run      Preview updates without writing global.ini
  --ptu          Use PTU source data
  -v, --verbose  Enable verbose logging
  -h, --help     Show this message`,
  );
}

export async function runPipelineCommand(
  argv: string[],
  io: CommandIO = defaultCommandIO(),
  dependencies: PipelineCommandDependencies = {},
): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      cached: { type: 'boolean', default: false },
      'repo-only': { type: 'boolean', default: false },
      'rebuild-cache': { type: 'boolean', default: false },
      scrape: { type: 'boolean', default: false },
      datacore: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      ptu: { type: 'boolean', default: false },
      'skip-unforge': { type: 'boolean', default: false },
      verbose: { type: 'boolean', short: 'v', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });

  if (values.help) {
    printHelp(io);
    return 0;
  }

  const force = values['rebuild-cache'] || isNpmConfigFlagEnabled('rebuild-cache');
  const refreshSources = !values.cached;
  const sourceTarget = values.datacore && !values.scrape ? 'datacore' : 'all';
  const deployUpdatedIni = !values['repo-only'];
  const repoIniPath = path.join(ROOT_DIR, 'global.ini');
  const refresh = dependencies.refreshGlobalIni ?? refreshGlobalIni;
  const refreshSourcesUseCase = dependencies.refreshSourceCache ?? refreshSourceCache;
  const dataCoreScrapePlanFactory = dependencies.createDataCoreScrapePlan ?? createDataCoreScrapePlan;
  const scmdbScrapePlanFactory = dependencies.createScmdbScrapePlan ?? createScmdbScrapePlan;
  const runUpdate = dependencies.runBatchUpdate ?? runBatchUpdate;
  const batchUpdatePlanFactory = dependencies.createBatchUpdatePlan ?? createBatchUpdatePlan;
  const deploy = dependencies.deployGlobalIni ?? deployGlobalIni;

  const tasks = createPipelineTasks({
    refreshSources,
    sourceTarget,
    deployUpdatedIni,
    dryRun: values['dry-run'],
    ptu: values.ptu,
    force,
    verbose: values.verbose,
    refresh,
    refreshSourcesUseCase,
    dataCoreScrapePlanFactory,
    useDataCoreScrapePlan: !dependencies.refreshSourceCache || Boolean(dependencies.createDataCoreScrapePlan),
    scmdbScrapePlanFactory,
    useScmdbScrapePlan: !dependencies.refreshSourceCache || Boolean(dependencies.createScmdbScrapePlan),
    runUpdate,
    batchUpdatePlanFactory,
    useBatchUpdatePlan: !dependencies.runBatchUpdate || Boolean(dependencies.createBatchUpdatePlan),
    deploy,
  });
  const context: PipelineTaskContext = { repoIniPath, reports: [] };
  const taskList = createCommandTaskList<PipelineTaskContext>(tasks, io, context, { verbose: values.verbose });

  try {
    await taskList.run();
  } catch (error) {
    writeErrorLine(io, error instanceof Error ? error.message : String(error));
    return 1;
  }

  if (context.reports.length > 0) {
    writeLine(io, `\n${context.reports.join('\n\n')}`);
  }
  writeLine(io, '\nPipeline complete.');
  return 0;
}

function createPipelineTasks(options: {
  refreshSources: boolean;
  sourceTarget: SourceCacheTarget;
  deployUpdatedIni: boolean;
  dryRun: boolean;
  ptu: boolean;
  force: boolean;
  verbose: boolean;
  refresh: typeof refreshGlobalIni;
  refreshSourcesUseCase: typeof refreshSourceCache;
  dataCoreScrapePlanFactory: typeof createDataCoreScrapePlan;
  useDataCoreScrapePlan: boolean;
  scmdbScrapePlanFactory: typeof createScmdbScrapePlan;
  useScmdbScrapePlan: boolean;
  runUpdate: typeof runBatchUpdate;
  batchUpdatePlanFactory: typeof createBatchUpdatePlan;
  useBatchUpdatePlan: boolean;
  deploy: typeof deployGlobalIni;
}): CommandTask<PipelineTaskContext>[] {
  return [
    {
      title: 'Extract fresh global.ini',
      task: async (ctx, task) => {
        const result = await options.refresh({
          repoIniPath: ctx.repoIniPath,
          log: (message) => {
            task.output = message;
          },
        });
        ctx.extractedGamePath = result.extractedGamePath;
        task.output = `Synced to ${result.repoIniPath}`;
      },
    },
    {
      title: options.refreshSources ? 'Refresh source caches' : 'Use cached source outputs',
      task: (_ctx, task) => {
        if (!options.refreshSources) {
          task.skip('using existing SCMDB/DataCore outputs');
          return;
        }

        const sourceTasks = selectSources(options.sourceTarget).map((source) =>
          createSourceRefreshTask(source, options),
        );
        return createPlannedChildTaskList(task, {
          title: 'Refresh source caches',
          tasks: sourceTasks,
          unit: 'source',
          plannedUnit: 'source cache',
          concurrent: 2,
        });
      },
    },
    {
      title: 'Apply localization updates',
      task: (ctx, task) => {
        if (options.useBatchUpdatePlan) {
          return createBatchUpdateTask(ctx, task, options);
        }

        return runBatchUpdateWithTitleProgress(ctx, task, options);
      },
    },
    {
      title: 'Deploy global.ini to game',
      skip: !options.deployUpdatedIni ? '--repo-only' : false,
      task: async (ctx, task) => {
        if (!ctx.extractedGamePath) {
          throw new Error('Cannot deploy because the extracted game global.ini path is missing.');
        }
        await options.deploy({ repoIniPath: ctx.repoIniPath, targetIniPath: ctx.extractedGamePath });
        task.output = `Deployed to ${ctx.extractedGamePath}`;
      },
    },
  ];
}

async function runBatchUpdateWithTitleProgress(
  ctx: PipelineTaskContext,
  task: Parameters<CommandTask<PipelineTaskContext>['task']>[1],
  options: {
    dryRun: boolean;
    ptu: boolean;
    verbose: boolean;
    runUpdate: typeof runBatchUpdate;
  },
): Promise<void> {
  const baseTitle = 'Apply localization updates';
  const updateResult = await options.runUpdate({
    repoRoot: ROOT_DIR,
    dryRun: options.dryRun,
    ptu: options.ptu,
    provider: 'datacore',
    onCategoryStart: (category, index) => {
      task.title = `${baseTitle} - updating ${index + 1}: ${category.config.label}`;
    },
    onCategoryError: (error) => {
      task.output = `Category ${error.label} failed: ${error.message}`;
    },
    onExtraStepStart: (label, index) => {
      task.title = `${baseTitle} - extra step ${index + 1}: ${label}`;
    },
    onExtraStepError: (error) => {
      task.output = `Extra step ${error.label} failed: ${error.message}`;
    },
  });

  collectBatchUpdateReports(ctx, updateResult, options.verbose);

  if (updateResult.exitCode !== 0) {
    throw new Error('Localization update failed.');
  }
  task.title = baseTitle;
  task.output = formatBatchUpdateSummary(updateResult);
}

function createBatchUpdateTask(
  ctx: PipelineTaskContext,
  task: Parameters<CommandTask<PipelineTaskContext>['task']>[1],
  options: {
    dryRun: boolean;
    ptu: boolean;
    verbose: boolean;
    batchUpdatePlanFactory: typeof createBatchUpdatePlan;
  },
) {
  const plan = options.batchUpdatePlanFactory({
    repoRoot: ROOT_DIR,
    dryRun: options.dryRun,
    ptu: options.ptu,
    provider: 'datacore',
    onCategoryError: (error) => {
      task.output = `Category ${error.label} failed: ${error.message}`;
    },
    onExtraStepError: (error) => {
      task.output = `Extra step ${error.label} failed: ${error.message}`;
    },
  });
  let prepared: PreparedUpdateCategories | undefined;

  return task.newListr(
    [
      {
        title: 'Prepare update sources',
        task: async (_childCtx, childTask) => {
          prepared = await plan.prepare();
          childTask.output = `${prepared.categories.length.toLocaleString()} categories ready`;
        },
      },
      {
        title: 'Validate source coverage',
        task: () => plan.preflight(),
      },
      {
        title: 'Backup global.ini',
        skip: options.dryRun ? 'dry run' : false,
        task: () => plan.backup(),
      },
      {
        title: 'Update categories',
        task: (_childCtx, childTask) => {
          if (!prepared) throw new Error('Update categories were not prepared.');
          const categories = prepared.categories;
          const categoryGroups = groupUpdateCategories(categories);
          return createPlannedChildTaskList(childTask, {
            title: 'Update categories',
            tasks: categoryGroups.map((group) => ({
              title: group.title,
              task: async (_groupCtx, groupTask) => {
                await runCompactTaskList(groupTask, {
                  title: group.title,
                  items: group.categories,
                  unit: 'category',
                  label: (category) => category.config.label,
                  task: (category) => plan.runCategory(category, categories.indexOf(category)),
                  summary: (result) => result?.summary ?? 'No changes',
                });
              },
            })),
            unit: 'group',
            plannedUnit: 'category',
            summary: `${categories.length.toLocaleString()} categories across ${categoryGroups.length.toLocaleString()} groups`,
            plannedSummary: `${categories.length.toLocaleString()} categories planned`,
          });
        },
      },
      {
        title: 'Run extra update steps',
        task: (_childCtx, childTask) => {
          const labels = plan.getExtraStepLabels();
          return createPlannedChildTaskList(childTask, {
            title: 'Run extra update steps',
            tasks: createIndexedTasks(labels, {
              title: (label) => label,
              task: (label, index) => async (_stepCtx, stepTask) => {
                const result = await plan.runExtraStep(label, index);
                stepTask.output = result?.summary ?? 'Skipped';
              },
            }),
            unit: 'step',
            plannedUnit: 'extra step',
          });
        },
      },
      {
        title: 'Complete localization updates',
        task: (_childCtx, childTask) => {
          const updateResult = plan.result();
          collectBatchUpdateReports(ctx, updateResult, options.verbose);
          if (updateResult.exitCode !== 0) {
            throw new Error('Localization update failed.');
          }
          childTask.output = formatBatchUpdateSummary(updateResult);
        },
      },
    ],
    { concurrent: false },
  );
}

function collectBatchUpdateReports(
  ctx: PipelineTaskContext,
  updateResult: Awaited<ReturnType<typeof runBatchUpdate>>,
  verbose: boolean,
): void {
  if (verbose) {
    ctx.reports.push(formatSourceFreshnessDiagnostics(updateResult.sourceDiagnostics));
    if (updateResult.scmdbDependencyAudit) {
      ctx.reports.push(formatScmdbDependencyAudit(updateResult.scmdbDependencyAudit));
    }
  }
}

function formatBatchUpdateSummary(updateResult: Awaited<ReturnType<typeof runBatchUpdate>>): string {
  const warningSummary =
    updateResult.sourceDiagnostics.warnings.length > 0
      ? `; ${updateResult.sourceDiagnostics.warnings.length.toLocaleString()} source warning(s), rerun with --verbose for details`
      : '';
  return `Applied updates in ${updateResult.totalDurationMs}ms${warningSummary}`;
}

function selectSources(target: SourceCacheTarget): SourceCacheSource[] {
  if (target === 'scmdb') return ['scmdb'];
  if (target === 'datacore') return ['datacore'];
  return ['scmdb', 'datacore'];
}

function createSourceRefreshTask(
  source: SourceCacheSource,
  options: {
    ptu: boolean;
    force: boolean;
    refreshSourcesUseCase: typeof refreshSourceCache;
    dataCoreScrapePlanFactory: typeof createDataCoreScrapePlan;
    useDataCoreScrapePlan: boolean;
    scmdbScrapePlanFactory: typeof createScmdbScrapePlan;
    useScmdbScrapePlan: boolean;
  },
): CommandTask<PipelineTaskContext> {
  const baseTitle = `${source.toUpperCase()} cache`;
  if (source === 'datacore' && options.useDataCoreScrapePlan) {
    return createDataCoreRefreshTask(baseTitle, options);
  }
  if (source === 'scmdb' && options.useScmdbScrapePlan) {
    return createScmdbScrapeTask({
      title: baseTitle,
      repoRoot: ROOT_DIR,
      ptu: options.ptu,
      planFactory: options.scmdbScrapePlanFactory,
    });
  }

  return {
    title: baseTitle,
    task: (_ctx, task) => {
      return options
        .refreshSourcesUseCase({
          repoRoot: ROOT_DIR,
          target: source,
          ptu: options.ptu,
          force: options.force,
          log: (message) => {
            task.output = message;
          },
          ...(source === 'datacore' ? createDataCoreProgressCallbacks({ task, baseTitle }) : {}),
        })
        .then((result) => {
          if (result.exitCode !== 0) {
            throw new Error(`${source.toUpperCase()} cache refresh failed.`);
          }
          task.title = baseTitle;
        });
    },
  };
}

function createDataCoreRefreshTask(
  baseTitle: string,
  options: {
    ptu: boolean;
    force: boolean;
    dataCoreScrapePlanFactory: typeof createDataCoreScrapePlan;
  },
): CommandTask<PipelineTaskContext> {
  return createDataCoreScrapeTask({
    title: baseTitle,
    repoRoot: ROOT_DIR,
    ptu: options.ptu,
    forceExtract: options.force,
    planFactory: options.dataCoreScrapePlanFactory,
  });
}
