import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  refreshSourceCache,
  type SourceCacheSource,
  type SourceCacheTarget,
} from '../../application/use-cases/refresh-source-cache';
import { createDataCoreScrapePlan } from '../../application/use-cases/run-datacore-scrape';
import { createScmdbScrapePlan } from '../../application/use-cases/run-scmdb-scrape';
import { type CommandIO, defaultCommandIO, isNpmConfigFlagEnabled, writeErrorLine, writeLine } from '../cli';
import { createDataCoreProgressCallbacks } from '../datacore-progress';
import { createDataCoreScrapeTask } from '../datacore-task';
import { createScmdbScrapeTask } from '../scmdb-task';
import { createPlannedChildTaskList } from '../task-builders';
import { type CommandTask, createCommandTaskList } from '../task-list';

const ROOT_DIR = path.resolve(import.meta.dirname, '..', '..', '..');

interface CacheCommandDependencies {
  refreshSourceCache?: typeof refreshSourceCache;
  createDataCoreScrapePlan?: typeof createDataCoreScrapePlan;
  createScmdbScrapePlan?: typeof createScmdbScrapePlan;
}

function printHelp(io: CommandIO): void {
  writeLine(
    io,
    `Usage: node --import tsx/esm bin/cache.ts [options]

Refresh source caches without updating global.ini.

Options:
  --source <all|datacore|scmdb>  Source cache to refresh (default: all)
  --ptu                         Use PTU source data
  --rebuild-cache               Rebuild expensive DataCore DCB/XML caches
  -h, --help                    Show this message`,
  );
}

function parseTarget(value: string | undefined): SourceCacheTarget {
  if (!value) return 'all';
  if (value === 'all' || value === 'datacore' || value === 'scmdb') return value;
  throw new Error(`Unknown --source "${value}". Expected all, datacore, or scmdb.`);
}

export async function runCacheCommand(
  argv: string[],
  io: CommandIO = defaultCommandIO(),
  dependencies: CacheCommandDependencies = {},
): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      source: { type: 'string', default: 'all' },
      ptu: { type: 'boolean', default: false },
      'rebuild-cache': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });

  if (values.help) {
    printHelp(io);
    return 0;
  }

  const target = parseTarget(values.source);
  const refresh = dependencies.refreshSourceCache ?? refreshSourceCache;
  const dataCoreScrapePlanFactory = dependencies.createDataCoreScrapePlan ?? createDataCoreScrapePlan;
  const useDataCoreScrapePlan = !dependencies.refreshSourceCache || Boolean(dependencies.createDataCoreScrapePlan);
  const scmdbScrapePlanFactory = dependencies.createScmdbScrapePlan ?? createScmdbScrapePlan;
  const useScmdbScrapePlan = !dependencies.refreshSourceCache || Boolean(dependencies.createScmdbScrapePlan);
  const force = values['rebuild-cache'] || isNpmConfigFlagEnabled('rebuild-cache');

  try {
    await createCommandTaskList(
      [
        {
          title: target === 'all' ? 'Refresh source caches' : `Refresh ${target.toUpperCase()} cache`,
          task: (_ctx, task) => {
            const sourceTasks = createSourceTasks(
              target,
              refresh,
              dataCoreScrapePlanFactory,
              useDataCoreScrapePlan,
              scmdbScrapePlanFactory,
              useScmdbScrapePlan,
              values.ptu,
              force,
            );
            return createPlannedChildTaskList(task, {
              title: target === 'all' ? 'Refresh source caches' : `Refresh ${target.toUpperCase()} cache`,
              tasks: sourceTasks,
              unit: 'source',
              plannedUnit: 'source cache',
              concurrent: 2,
            });
          },
        },
      ],
      io,
      {},
    ).run();
  } catch (error) {
    writeErrorLine(io, error instanceof Error ? error.message : String(error));
    return 1;
  }

  writeLine(io, `\nCache refresh complete: ${selectSources(target).join(', ') || 'none'}`);
  return 0;
}

function selectSources(target: SourceCacheTarget): SourceCacheSource[] {
  if (target === 'scmdb') return ['scmdb'];
  if (target === 'datacore') return ['datacore'];
  return ['scmdb', 'datacore'];
}

function createSourceTasks(
  target: SourceCacheTarget,
  refresh: typeof refreshSourceCache,
  dataCoreScrapePlanFactory: typeof createDataCoreScrapePlan,
  useDataCoreScrapePlan: boolean,
  scmdbScrapePlanFactory: typeof createScmdbScrapePlan,
  useScmdbScrapePlan: boolean,
  ptu: boolean,
  force: boolean,
): CommandTask<Record<string, never>>[] {
  return selectSources(target).map((source) => {
    const baseTitle = `${source.toUpperCase()} cache`;

    if (source === 'datacore' && useDataCoreScrapePlan) {
      return createDataCoreRefreshTask(baseTitle, { ptu, force, dataCoreScrapePlanFactory });
    }
    if (source === 'scmdb' && useScmdbScrapePlan) {
      return createScmdbScrapeTask({
        title: baseTitle,
        repoRoot: ROOT_DIR,
        ptu,
        planFactory: scmdbScrapePlanFactory,
      });
    }

    return {
      title: baseTitle,
      task: (_ctx, task) => {
        return refresh({
          repoRoot: ROOT_DIR,
          target: source,
          ptu,
          force,
          log: (message) => {
            task.output = message;
          },
          ...(source === 'datacore' ? createDataCoreProgressCallbacks({ task, baseTitle }) : {}),
        }).then((result) => {
          if (result.exitCode !== 0) {
            throw new Error(`${source.toUpperCase()} cache refresh failed.`);
          }
          task.title = baseTitle;
        });
      },
    };
  });
}

function createDataCoreRefreshTask(
  baseTitle: string,
  options: {
    ptu: boolean;
    force: boolean;
    dataCoreScrapePlanFactory: typeof createDataCoreScrapePlan;
  },
): CommandTask<Record<string, never>> {
  return createDataCoreScrapeTask({
    title: baseTitle,
    repoRoot: ROOT_DIR,
    ptu: options.ptu,
    forceExtract: options.force,
    planFactory: options.dataCoreScrapePlanFactory,
  });
}
