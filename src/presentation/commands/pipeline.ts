import path from 'node:path';
import { parseArgs } from 'node:util';
import { runFullPipeline } from '../../application/use-cases/run-full-pipeline';
import { type CommandIO, defaultCommandIO, isNpmConfigFlagEnabled, writeLine } from '../cli';
import { createCliEventRenderer } from '../events';

const ROOT_DIR = path.resolve(import.meta.dirname, '..', '..', '..');

interface PipelineCommandDependencies {
  runFullPipeline?: typeof runFullPipeline;
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

  const renderer = createCliEventRenderer(io);
  const force = values['rebuild-cache'] || isNpmConfigFlagEnabled('rebuild-cache');
  const refreshSources = !values.cached;
  const deployUpdatedIni = !values['repo-only'];
  const phaseTotal = 4;
  let phaseIndex = 0;
  let scrapeTypesCount = 0;
  const sourceRefreshPhaseId = 'refresh-sources';

  const log = (message: string) => writeLine(io, `[pipeline] ${message}`);
  const completeStep = (summary: string) => {
    renderer.emit({ type: 'task:success', id: summary, label: summary });
  };

  const run = dependencies.runFullPipeline ?? runFullPipeline;
  const result = await run({
    rootDir: ROOT_DIR,
    scrape: values.scrape,
    datacore: values.datacore,
    refreshSources,
    deployUpdatedIni,
    dryRun: values['dry-run'],
    ptu: values.ptu,
    skipUnforge: values['skip-unforge'],
    force,
    verbose: values.verbose,
    log,
    onPhaseStart: (phase) => {
      phaseIndex++;
      renderer.emit({ type: 'phase:start', index: phaseIndex, total: phaseTotal, ...phase });
    },
    onStepComplete: completeStep,
    onSourceStart: (source) => {
      renderer.emit({
        type: 'task:start',
        id: `${source}-cache`,
        parentId: sourceRefreshPhaseId,
        label: `${source.toUpperCase()} cache`,
        detail: 'refreshing source outputs',
      });
    },
    onSourceComplete: (source) => {
      renderer.emit({
        type: 'task:success',
        id: `${source}-cache`,
        parentId: sourceRefreshPhaseId,
        label: `${source.toUpperCase()} cache`,
        detail: 'source outputs refreshed',
      });
    },
    onCacheExtractStart: () => {
      log('WARNING: The unforge step is intensive, long-running, and will take a while.');
      renderer.emit({
        type: 'activity:start',
        id: 'unforge',
        parentId: 'datacore-cache',
        label: 'Unforge',
        detail: 'extracting XML records...',
      });
    },
    onCacheExtractProgress: (count) => {
      renderer.emit({
        type: 'activity:update',
        id: 'unforge',
        parentId: 'datacore-cache',
        count,
        unit: 'XMLs extracted',
      });
    },
    onCacheHit: (count) => {
      renderer.emit({
        type: 'task:success',
        id: 'unforge-cache',
        parentId: 'datacore-cache',
        label: 'DataCore XML cache',
        detail: `${count.toLocaleString()} files reused`,
      });
    },
    onCacheExtractComplete: (count) => {
      renderer.emit({
        type: 'activity:stop',
        id: 'unforge',
        parentId: 'datacore-cache',
        count,
        unit: 'XMLs extracted',
      });
    },
    onDatacorePrepared: (context) => {
      scrapeTypesCount = context.selectedTypes.length;
    },
    onRecordGraphStart: (total) => {
      renderer.emit({ type: 'progress:start', id: 'graph', parentId: 'datacore-cache', label: 'Graph', total });
    },
    onRecordGraphProgress: (current, total) => {
      renderer.emit({ type: 'progress:update', id: 'graph', parentId: 'datacore-cache', value: current, total });
      if (current >= total) renderer.emit({ type: 'progress:stop', id: 'graph', parentId: 'datacore-cache' });
    },
    onRecordGraphCacheHit: (_recordCount, outputPath) => {
      renderer.emit({
        type: 'task:success',
        id: 'record-graph-cache',
        parentId: 'datacore-cache',
        label: 'DataCore record graph',
        detail: `cached at ${outputPath}`,
      });
    },
    onRawFactStart: (slug, total) => {
      renderer.emit({ type: 'progress:start', id: 'scrape', parentId: 'datacore-cache', label: 'Scraping', total });
      renderer.emit({ type: 'progress:update', id: 'scrape', parentId: 'datacore-cache', value: 0, label: slug });
    },
    onRawFactProgress: (current) => {
      renderer.emit({ type: 'progress:update', id: 'scrape', parentId: 'datacore-cache', value: current });
    },
    onTypeStart: (entry, index) => {
      if (index === 0)
        renderer.emit({
          type: 'progress:start',
          id: 'scrape',
          parentId: 'datacore-cache',
          label: 'Scraping',
          total: scrapeTypesCount,
        });
      renderer.emit({
        type: 'progress:update',
        id: 'scrape',
        parentId: 'datacore-cache',
        value: index,
        label: entry.name,
      });
    },
  });

  renderer.emit({ type: 'progress:update', id: 'scrape', parentId: 'datacore-cache', value: scrapeTypesCount });
  renderer.emit({ type: 'progress:stop', id: 'scrape', parentId: 'datacore-cache' });
  renderer.stopAll();

  renderer.emit({ type: 'summary', message: '\nPipeline complete.' });
  return result.exitCode;
}
