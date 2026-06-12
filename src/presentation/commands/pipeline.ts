import path from 'node:path';
import { parseArgs } from 'node:util';
import { formatScmdbDependencyAudit } from '../../application/diagnostics/scmdb-dependency-audit';
import { formatSourceFreshnessDiagnostics } from '../../application/diagnostics/source-freshness-diagnostics';
import { deployGlobalIni } from '../../application/use-cases/deploy-global-ini';
import { refreshGlobalIni } from '../../application/use-cases/refresh-global-ini';
import {
  refreshSourceCache,
  type SourceCacheSource,
  type SourceCacheTarget,
} from '../../application/use-cases/refresh-source-cache';
import { runBatchUpdate } from '../../application/use-cases/run-batch-update';
import type { DataCoreTypeEntry } from '../../application/use-cases/run-datacore-scrape';
import { type CommandIO, defaultCommandIO, isNpmConfigFlagEnabled, writeErrorLine, writeLine } from '../cli';
import { type CommandTask, createCommandTaskList } from '../task-list';

const ROOT_DIR = path.resolve(import.meta.dirname, '..', '..', '..');

interface PipelineCommandDependencies {
  refreshGlobalIni?: typeof refreshGlobalIni;
  refreshSourceCache?: typeof refreshSourceCache;
  runBatchUpdate?: typeof runBatchUpdate;
  deployGlobalIni?: typeof deployGlobalIni;
}

interface PipelineTaskContext {
  extractedGamePath?: string;
  repoIniPath: string;
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
  const runUpdate = dependencies.runBatchUpdate ?? runBatchUpdate;
  const deploy = dependencies.deployGlobalIni ?? deployGlobalIni;

  const tasks = createPipelineTasks({
    refreshSources,
    sourceTarget,
    deployUpdatedIni,
    dryRun: values['dry-run'],
    ptu: values.ptu,
    force,
    refresh,
    refreshSourcesUseCase,
    runUpdate,
    deploy,
  });
  const taskList = createCommandTaskList<PipelineTaskContext>(tasks, io, { repoIniPath });

  try {
    await taskList.run();
  } catch (error) {
    writeErrorLine(io, error instanceof Error ? error.message : String(error));
    return 1;
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
  refresh: typeof refreshGlobalIni;
  refreshSourcesUseCase: typeof refreshSourceCache;
  runUpdate: typeof runBatchUpdate;
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

        return task.newListr(
          selectSources(options.sourceTarget).map((source) => createSourceRefreshTask(source, options)),
          {
            concurrent: 2,
          },
        );
      },
    },
    {
      title: 'Apply localization updates',
      task: async (_ctx, task) => {
        const updateResult = await options.runUpdate({
          repoRoot: ROOT_DIR,
          dryRun: options.dryRun,
          ptu: options.ptu,
          provider: 'datacore',
          onCategoryStart: (category, index) => {
            task.output = `Updating ${index + 1}: ${category.config.label}`;
          },
          onCategoryError: (error) => {
            task.output = `Category ${error.label} failed: ${error.message}`;
          },
          onExtraStepStart: (label, index) => {
            task.output = `Extra step ${index + 1}: ${label}`;
          },
          onExtraStepError: (error) => {
            task.output = `Extra step ${error.label} failed: ${error.message}`;
          },
        });
        task.output = formatSourceFreshnessDiagnostics(updateResult.sourceDiagnostics);
        if (updateResult.scmdbDependencyAudit) {
          task.output = formatScmdbDependencyAudit(updateResult.scmdbDependencyAudit);
        }
        if (updateResult.exitCode !== 0) {
          throw new Error('Localization update failed.');
        }
        task.output = `Applied updates in ${updateResult.totalDurationMs}ms`;
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
  },
): CommandTask<PipelineTaskContext> {
  return {
    title: `${source.toUpperCase()} cache`,
    task: async (_ctx, task) => {
      let scrapeTypesCount = 0;
      const result = await options.refreshSourcesUseCase({
        repoRoot: ROOT_DIR,
        target: source,
        ptu: options.ptu,
        force: options.force,
        log: (message) => {
          task.output = message;
        },
        onCacheExtractStart: () => {
          task.output = 'Unforge: extracting XML records. This can take several minutes.';
        },
        onCacheExtractProgress: (count) => {
          task.output = `Unforge: ${count.toLocaleString()} XMLs extracted`;
        },
        onCacheExtractComplete: (count) => {
          task.output = `Unforge complete: ${count.toLocaleString()} XML records cached`;
        },
        onCacheHit: (count) => {
          task.output = `DataCore XML cache reused: ${count.toLocaleString()} files`;
        },
        onDatacorePrepared: (context) => {
          scrapeTypesCount = context.selectedTypes.length;
          task.output = `Prepared ${scrapeTypesCount.toLocaleString()} DataCore type extractors`;
        },
        onRecordGraphStart: (total) => {
          task.output = `Building record graph from ${total.toLocaleString()} XML files`;
        },
        onRecordGraphProgress: (current, total) => {
          task.output = `Record graph: ${current.toLocaleString()}/${total.toLocaleString()}`;
        },
        onRecordGraphCacheHit: (recordCount) => {
          task.output = `DataCore record graph reused: ${recordCount.toLocaleString()} records`;
        },
        onRawFactStart: (slug, total) => {
          task.output = `Extracting ${slug}: 0/${total.toLocaleString()}`;
        },
        onRawFactProgress: (current) => {
          task.output = `Extracting raw facts: ${current.toLocaleString()}`;
        },
        onTypeStart: (entry: DataCoreTypeEntry, index) => {
          task.output = `Scraping ${index + 1}/${scrapeTypesCount}: ${entry.name}`;
        },
      });

      if (result.exitCode !== 0) {
        throw new Error(`${source.toUpperCase()} cache refresh failed.`);
      }
      task.output = `${source.toUpperCase()} source outputs refreshed`;
    },
  };
}
