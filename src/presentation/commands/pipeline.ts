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
  const totalSteps = 2 + (refreshSources ? 2 : 0) + (deployUpdatedIni ? 1 : 0);
  let completedSteps = 0;
  let scrapeTypesCount = 0;

  const log = (message: string) => writeLine(io, `[pipeline] ${message}`);
  const completeStep = (summary: string) => {
    completedSteps++;
    renderer.emit({
      type: 'progress:start',
      id: 'pipeline',
      label: 'Pipeline',
      total: totalSteps,
      value: completedSteps,
    });
    renderer.emit({ type: 'progress:update', id: 'pipeline', value: completedSteps, label: summary });
    renderer.emit({ type: 'progress:stop', id: 'pipeline' });
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
    onStepComplete: completeStep,
    onCacheExtractStart: () => {
      log('WARNING: The unforge step is intensive, long-running, and will take a while.');
      renderer.emit({ type: 'activity:start', id: 'unforge', label: 'Unforge', detail: 'extracting XML records...' });
    },
    onCacheExtractProgress: (count) => {
      renderer.emit({ type: 'activity:update', id: 'unforge', count, unit: 'XMLs extracted' });
    },
    onCacheHit: (count) => {
      log('Using cached XMLs (Skipping extraction)...');
      renderer.emit({ type: 'progress:start', id: 'unforge', label: 'Unforge', total: count, value: count });
      renderer.emit({ type: 'progress:update', id: 'unforge', value: count, label: 'Cached' });
      renderer.emit({ type: 'progress:stop', id: 'unforge' });
    },
    onCacheExtractComplete: (count) => {
      renderer.emit({ type: 'activity:stop', id: 'unforge', count, unit: 'XMLs extracted' });
    },
    onDatacorePrepared: (context) => {
      scrapeTypesCount = context.selectedTypes.length;
    },
    onRecordGraphStart: (total) => {
      log('Building DataCore record graph (parsing all XML files)...');
      renderer.emit({ type: 'progress:start', id: 'graph', label: 'Graph', total });
    },
    onRecordGraphProgress: (current, total) => {
      renderer.emit({ type: 'progress:update', id: 'graph', value: current, total });
      if (current >= total) renderer.emit({ type: 'progress:stop', id: 'graph' });
    },
    onRecordGraphCacheHit: (_recordCount, outputPath) => {
      log(`Using cached DataCore record graph: ${outputPath}`);
    },
    onRawFactStart: (slug, total) => {
      renderer.emit({ type: 'progress:start', id: 'scrape', label: 'Scraping', total });
      renderer.emit({ type: 'progress:update', id: 'scrape', value: 0, label: slug });
    },
    onRawFactProgress: (current) => {
      renderer.emit({ type: 'progress:update', id: 'scrape', value: current });
    },
    onTypeStart: (entry, index) => {
      if (index === 0)
        renderer.emit({ type: 'progress:start', id: 'scrape', label: 'Scraping', total: scrapeTypesCount });
      renderer.emit({ type: 'progress:update', id: 'scrape', value: index, label: entry.name });
    },
  });

  renderer.emit({ type: 'progress:update', id: 'scrape', value: scrapeTypesCount });
  renderer.emit({ type: 'progress:stop', id: 'scrape' });
  renderer.stopAll();

  log('=== Done ===');
  return result.exitCode;
}
