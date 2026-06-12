import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  refreshSourceCache,
  type SourceCacheSource,
  type SourceCacheTarget,
} from '../../application/use-cases/refresh-source-cache';
import type { DataCoreTypeEntry } from '../../application/use-cases/run-datacore-scrape';
import { type CommandIO, defaultCommandIO, isNpmConfigFlagEnabled, writeErrorLine, writeLine } from '../cli';
import { type CommandTask, createCommandTaskList } from '../task-list';

const ROOT_DIR = path.resolve(import.meta.dirname, '..', '..', '..');

interface CacheCommandDependencies {
  refreshSourceCache?: typeof refreshSourceCache;
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
  const force = values['rebuild-cache'] || isNpmConfigFlagEnabled('rebuild-cache');

  try {
    await createCommandTaskList(
      [
        {
          title: target === 'all' ? 'Refresh source caches' : `Refresh ${target.toUpperCase()} cache`,
          task: (_ctx, task) => task.newListr(createSourceTasks(target, refresh, values.ptu, force), { concurrent: 2 }),
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
  ptu: boolean,
  force: boolean,
): CommandTask<Record<string, never>>[] {
  return selectSources(target).map((source) => ({
    title: `${source.toUpperCase()} cache`,
    task: async (_ctx, task) => {
      let scrapeTypesCount = 0;
      const result = await refresh({
        repoRoot: ROOT_DIR,
        target: source,
        ptu,
        force,
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
  }));
}
