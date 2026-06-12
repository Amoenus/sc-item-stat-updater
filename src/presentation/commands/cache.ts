import path from 'node:path';
import { parseArgs } from 'node:util';
import { refreshSourceCache, type SourceCacheTarget } from '../../application/use-cases/refresh-source-cache';
import type { DataCoreTypeEntry } from '../../application/use-cases/run-datacore-scrape';
import { type CommandIO, defaultCommandIO, isNpmConfigFlagEnabled, writeLine } from '../cli';
import { createCliEventRenderer } from '../events';

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
  const renderer = createCliEventRenderer(io);
  const refresh = dependencies.refreshSourceCache ?? refreshSourceCache;
  const force = values['rebuild-cache'] || isNpmConfigFlagEnabled('rebuild-cache');
  let scrapeTypesCount = 0;

  const result = await refresh({
    repoRoot: ROOT_DIR,
    target,
    ptu: values.ptu,
    force,
    log: (message) => writeLine(io, `[cache] ${message}`),
    onSourceStart: (source) => {
      renderer.emit({
        type: 'phase:start',
        id: `${source}-cache`,
        label: `${source.toUpperCase()} cache`,
        detail: 'refreshing source outputs',
      });
    },
    onCacheExtractStart: () => {
      writeLine(io, '[cache] WARNING: DataCore unforge can take several minutes.');
      renderer.emit({ type: 'activity:start', id: 'unforge', label: 'Unforge', detail: 'extracting XML records...' });
    },
    onCacheExtractProgress: (count) => {
      renderer.emit({ type: 'activity:update', id: 'unforge', count, unit: 'XMLs extracted' });
    },
    onCacheExtractComplete: (count) => {
      renderer.emit({ type: 'activity:stop', id: 'unforge', count, unit: 'XMLs extracted' });
    },
    onCacheHit: (count) => {
      renderer.emit({
        type: 'task:success',
        id: 'unforge-cache',
        label: 'DataCore XML cache',
        detail: `${count.toLocaleString()} files reused`,
      });
    },
    onDatacorePrepared: (context) => {
      scrapeTypesCount = context.selectedTypes.length;
    },
    onRecordGraphStart: (total) => {
      renderer.emit({ type: 'progress:start', id: 'graph', label: 'Graph', total });
    },
    onRecordGraphProgress: (current, total) => {
      renderer.emit({ type: 'progress:update', id: 'graph', value: current, total });
      if (current >= total) renderer.emit({ type: 'progress:stop', id: 'graph' });
    },
    onRecordGraphCacheHit: (_recordCount, outputPath) => {
      renderer.emit({
        type: 'task:success',
        id: 'record-graph-cache',
        label: 'DataCore record graph',
        detail: `cached at ${outputPath}`,
      });
    },
    onRawFactStart: (slug, total) => {
      renderer.emit({ type: 'progress:start', id: 'scrape', label: 'DataCore', total });
      renderer.emit({ type: 'progress:update', id: 'scrape', value: 0, label: slug });
    },
    onRawFactProgress: (current) => {
      renderer.emit({ type: 'progress:update', id: 'scrape', value: current });
    },
    onTypeStart: (entry: DataCoreTypeEntry, index) => {
      if (index === 0)
        renderer.emit({ type: 'progress:start', id: 'scrape', label: 'DataCore', total: scrapeTypesCount });
      renderer.emit({ type: 'progress:update', id: 'scrape', value: index, label: entry.name });
    },
  });

  renderer.emit({ type: 'progress:update', id: 'scrape', value: scrapeTypesCount });
  renderer.emit({ type: 'progress:stop', id: 'scrape' });
  renderer.stopAll();
  renderer.emit({ type: 'summary', message: `\nCache refresh complete: ${result.refreshed.join(', ') || 'none'}` });
  return result.exitCode;
}
