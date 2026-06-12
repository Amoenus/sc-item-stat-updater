import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  buildMiningJournalRarityComparison,
  formatMiningJournalRarityComparison,
} from '../../application/diagnostics/mining-journal-rarity-comparison';
import { formatScmdbDependencyAudit } from '../../application/diagnostics/scmdb-dependency-audit';
import { formatSourceFreshnessDiagnostics } from '../../application/diagnostics/source-freshness-diagnostics';
import type { PreparedUpdateCategories, UpdateProvider } from '../../application/use-cases/prepare-update-categories';
import { createBatchUpdatePlan, type RunBatchUpdateResult } from '../../application/use-cases/run-batch-update';
import type { BatchUpdateError, BatchUpdateResult } from '../../application/use-cases/run-prepared-update-categories';
import { type Artifact, generateArtifact, writeArtifactFile } from '../../artifact/artifact';
import { getLogger } from '../../infrastructure/logger';
import {
  applyLogFlags,
  type CommandIO,
  defaultCommandIO,
  registerUnhandledRejectionHandler,
  writeErrorLine,
  writeLine,
} from '../cli';
import { createIndexedTasks, createPlannedChildTaskList, runCompactTaskList } from '../task-builders';
import { createCommandTaskList } from '../task-list';
import { groupUpdateCategories } from '../update-category-groups';

const logger = getLogger('update-all');

type StepError = { label: string; message: string };
type AnyUpdateResult = BatchUpdateResult;

interface UpdateAllTaskContext {
  prepared?: PreparedUpdateCategories;
  plannedArtifact?: Artifact;
  result?: RunBatchUpdateResult;
}

function printSummary(io: CommandIO, results: AnyUpdateResult[], errors: StepError[], totalDuration: number): void {
  writeLine(io);
  for (const result of results) writeLine(io, result.summary);

  const allIssues = results.flatMap((result) =>
    ((result.issues ?? []) as Array<{ key: string; reason: string; type: string }>).map((issue) => ({
      label: result.label,
      ...issue,
    })),
  );
  if (allIssues.length > 0) {
    writeLine(io, '\nProblem rows:');
    for (const issue of allIssues) {
      const tag = issue.type ? `${issue.type.toUpperCase()} | ` : '';
      writeLine(io, `  ${issue.label} | ${tag}${issue.key} - ${issue.reason}`);
    }
  }

  for (const error of errors) writeErrorLine(io, `ERROR in ${error.label}: ${error.message}`);
  writeLine(io, `\n=== All updates complete [${totalDuration}ms] ===`);
}

function printHelp(io: CommandIO): void {
  writeLine(io, 'Usage: node update-all.js [options]');
  writeLine(io, '\nOptions:');
  writeLine(io, '  -i, --ini-path <path>  Path to global.ini (default: ./global.ini)');
  writeLine(
    io,
    '  -c, --csv-dir <path>   Directory containing CSV files (default: auto-detected from latest scraped version)',
  );
  writeLine(io, '      --dry-run          Preview changes without writing');
  writeLine(io, '      --emit-artifact <path>  Write a patch artifact JSON to the given path (ADR 002)');
  writeLine(io, '      --ptu              Use latest PTU scraped data instead of latest LIVE');
  writeLine(io, '      --include-mining-journal  Also update mining compendium journal entry');
  writeLine(io, '      --mining-journal-rarity-report  Print SCMDB vs DataCore mining journal rarity report and exit');
  writeLine(io, '      --provider datacore  Data provider (compatibility option; DataCore only)');
  writeLine(io, '  -v, --verbose          Enable verbose logging');
  writeLine(io, '      --json-logs        Output logs as JSON (for log aggregation)');
  writeLine(io, '  -h, --help             Show this help message');
}

export async function runUpdateAllCommand(argv: string[], io: CommandIO = defaultCommandIO()): Promise<number> {
  registerUnhandledRejectionHandler(logger);

  const { values } = parseArgs({
    args: argv,
    options: {
      'ini-path': { type: 'string', short: 'i' },
      'csv-dir': { type: 'string', short: 'c' },
      'dry-run': { type: 'boolean', default: false },
      'emit-artifact': { type: 'string' },
      ptu: { type: 'boolean', default: false },
      'include-mining-journal': { type: 'boolean', default: false },
      'mining-journal-rarity-report': { type: 'boolean', default: false },
      provider: { type: 'string', default: 'datacore' },
      verbose: { type: 'boolean', short: 'v', default: false },
      'json-logs': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });

  if (values.help) {
    printHelp(io);
    return 0;
  }

  applyLogFlags(values);

  const repoRoot = io.cwd;
  const providerValue = values.provider;
  if (providerValue !== 'datacore') {
    writeErrorLine(io, `Unknown --provider "${providerValue}". DataCore is the only active batch provider.`);
    return 1;
  }
  const provider: UpdateProvider = providerValue;

  const plan = createBatchUpdatePlan({
    repoRoot,
    iniPath: values['ini-path'],
    csvDir: values['csv-dir'],
    dryRun: values['dry-run'],
    includeMiningJournal: values['include-mining-journal'],
    provider,
    ptu: values.ptu,
    onCategoryError: (error: BatchUpdateError) => {
      logger.error('Failed to update category', {
        label: error.label,
        error: error.message,
        cause: error.cause,
      });
    },
    onExtraStepStart: (label) => {
      logger.info('Starting extra update step', { label });
    },
    onExtraStepError: (error: BatchUpdateError) => {
      logger.error(`Failed: ${error.label}`, { error: error.message, cause: error.cause });
    },
  });
  if (values['mining-journal-rarity-report']) {
    const prepared = await plan.prepare();
    writeLine(
      io,
      `${formatMiningJournalRarityComparison(
        await buildMiningJournalRarityComparison({
          scmdbDir: prepared.missionCsvDir,
          datacoreDir: prepared.itemVersionDir,
        }),
      )}\n`,
    );
    return 0;
  }

  const channel = values.ptu ? 'PTU' : 'LIVE';
  const iniPath = values['ini-path'] || path.join(repoRoot, 'global.ini');
  const context: UpdateAllTaskContext = {};
  const requirePrepared = (): PreparedUpdateCategories => {
    if (!context.prepared) throw new Error('Update sources were not prepared.');
    return context.prepared;
  };
  const taskList = createCommandTaskList(
    [
      {
        title: `Prepare update (${channel}, provider: ${provider})`,
        task: async (_ctx, task) => {
          context.prepared = await plan.prepare();
          logger.info('Starting batch update', {
            scmdbVersion: context.prepared.scmdbVersion,
            itemVersion: context.prepared.itemVersion,
            provider,
            channel,
            dryRun: values['dry-run'],
          });
          logger.debug('Starting batch update', {
            categoryCount: context.prepared.categories.length,
            dryRun: values['dry-run'],
          });
          task.output = `${context.prepared.categories.length.toLocaleString()} categories ready`;
        },
      },
      {
        title: 'Validate source coverage',
        task: () => plan.preflight(),
      },
      {
        title: 'Prepare patch artifact',
        skip: values['emit-artifact'] ? false : 'not requested',
        task: async (_ctx, task) => {
          const prepared = requirePrepared();
          context.plannedArtifact = await generateArtifact(prepared.categories, {
            iniPath,
            scmdbVersion: prepared.scmdbVersion,
          });
          task.output = `${context.plannedArtifact.stats.totalEntries.toLocaleString()} artifact entries planned`;
        },
      },
      {
        title: 'Backup global.ini',
        skip: values['dry-run'] ? 'dry run' : false,
        task: async () => {
          await plan.backup();
          logger.debug('Created global.ini backup before batch update');
        },
      },
      {
        title: 'Update categories',
        task: (_ctx, task) => {
          const prepared = requirePrepared();
          const categoryGroups = groupUpdateCategories(prepared.categories);
          return createPlannedChildTaskList(task, {
            title: 'Update categories',
            tasks: categoryGroups.map((group) => ({
              title: group.title,
              task: async (_groupCtx, groupTask) => {
                await runCompactTaskList(groupTask, {
                  title: group.title,
                  items: group.categories,
                  unit: 'category',
                  label: (category) => category.config.label,
                  task: (category) => plan.runCategory(category, prepared.categories.indexOf(category)),
                  summary: (result) => result?.summary ?? 'No changes',
                });
              },
            })),
            unit: 'group',
            plannedUnit: 'category',
            summary: `${prepared.categories.length.toLocaleString()} categories across ${categoryGroups.length.toLocaleString()} groups`,
            plannedSummary: `${prepared.categories.length.toLocaleString()} categories planned`,
          });
        },
      },
      {
        title: 'Run extra update steps',
        task: (_ctx, task) => {
          const labels = plan.getExtraStepLabels();
          return createPlannedChildTaskList(task, {
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
        title: 'Write patch artifact',
        skip: values['emit-artifact'] ? false : 'not requested',
        task: async (_ctx, task) => {
          if (!context.plannedArtifact || !values['emit-artifact']) {
            throw new Error('Patch artifact was not prepared before emission.');
          }
          const result = plan.result();
          const artifact: Artifact = {
            ...context.plannedArtifact,
            stats: {
              ...context.plannedArtifact.stats,
              totalErrors: context.plannedArtifact.stats.totalErrors + result.errors.length,
            },
          };
          const artifactPath = path.resolve(values['emit-artifact']);
          await writeArtifactFile(artifactPath, artifact);
          logger.info('Patch artifact written', { path: artifactPath, entries: artifact.stats.totalEntries });
          task.output = `Written to ${artifactPath} (${artifact.stats.totalEntries.toLocaleString()} entries)`;
        },
      },
      {
        title: 'Complete update',
        task: (_ctx, task) => {
          context.result = plan.result();
          task.output = `${context.result.results.length.toLocaleString()} result(s), ${context.result.errors.length.toLocaleString()} error(s)`;
        },
      },
    ],
    io,
    context,
    { verbose: values.verbose },
  );

  try {
    await taskList.run();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Batch update failed', { error: error.message });
    writeErrorLine(io, `\nERROR: ${error.message}\n`);
    return 1;
  }

  const result = context.result ?? plan.result();
  writeLine(io, `\n${formatSourceFreshnessDiagnostics(result.sourceDiagnostics)}`);
  if (result.scmdbDependencyAudit) {
    writeLine(io, `\n${formatScmdbDependencyAudit(result.scmdbDependencyAudit)}`);
  }
  if (values['emit-artifact']) {
    writeLine(io, `\nOK Artifact written -> ${path.resolve(values['emit-artifact'])}`);
  }
  printSummary(io, result.results, result.errors, result.totalDurationMs);

  logger.debug('Batch update complete', {
    totalDuration: result.totalDurationMs,
    successCount: result.results.length,
    errorCount: result.errors.length,
  });

  return result.exitCode;
}
