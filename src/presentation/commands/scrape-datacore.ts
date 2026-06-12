import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  type DataCoreTypeEntry,
  loadDataCoreTypeEntries,
  runDatacoreScrape,
} from '../../application/use-cases/run-datacore-scrape';
import { type CommandIO, defaultCommandIO, writeErrorLine, writeLine } from '../cli';
import { createCliEventRenderer } from '../events';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

function printHelp(io: CommandIO): void {
  writeLine(
    io,
    `
Usage: node scrape-datacore.js [options] [type...]

Scrapes item stats from the Star Citizen DataForge database and writes CSV files.
Source: LIVE/Data/Game*.dcb (already on disk - no p4k extraction needed).

Options:
  --all              Process all item types (default)
  --ptu              Tag output directory with "-ptu" channel
  --live             Tag output directory with "-live" channel (default)
  --list             Print available item types and exit
  --dry-run          Parse XMLs but do not write CSV files
  --force-extract    Re-run unforge even if the XML cache already exists
  -h, --help         Show this help message

Arguments:
  type...          One or more item type names (e.g. shields quantum-drives)
                   Run with --list to see all available types.

Environment:
  SC_LIVE_DIR      Path to the Star Citizen LIVE directory (required)
`.trim(),
  );
}

function printDatasetResult(
  io: CommandIO,
  label: string,
  rows: number,
  csvFile: string,
  dryNote: string,
  skipped?: number,
): void {
  const skippedNote = skipped && skipped > 0 ? ` (${skipped} skipped)` : '';
  writeLine(io, `  ${label.padEnd(28)} ${String(rows).padStart(4)} rows -> ${csvFile}${dryNote}${skippedNote}`);
}

export async function runScrapeDatacoreCommand(argv: string[], io: CommandIO = defaultCommandIO()): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      all: { type: 'boolean', default: false },
      ptu: { type: 'boolean', default: false },
      live: { type: 'boolean', default: false },
      list: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      'force-extract': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.help) {
    printHelp(io);
    return 0;
  }

  const allTypes = await loadDataCoreTypeEntries(REPO_ROOT);

  if (values.list) {
    writeLine(io, 'Available DataCore item types:');
    for (const type of allTypes) {
      writeLine(io, `  ${type.name.padEnd(28)} filter: ${type.typeConfig.recordFilter}`);
    }
    return 0;
  }

  let selectedTypes: DataCoreTypeEntry[];
  try {
    selectedTypes =
      positionals.length === 0
        ? allTypes
        : positionals.map((name) => {
            const found = allTypes.find((type) => type.name === name);
            if (!found) throw new Error(`Unknown item type: "${name}". Run with --list to see valid types.`);
            return found;
          });
  } catch (error) {
    writeErrorLine(io, error instanceof Error ? error.message : String(error));
    return 1;
  }

  const renderer = createCliEventRenderer(io);

  const result = await runDatacoreScrape({
    repoRoot: REPO_ROOT,
    binDirname: path.join(REPO_ROOT, 'bin'),
    ptu: values.ptu,
    dryRun: values['dry-run'],
    forceExtract: values['force-extract'],
    types: positionals,
    loadTypes: async () => allTypes,
    onPrepared: ({ gameVersion, channel, dcbPath, xmlCacheDir, outputBase, dryRun }) => {
      writeLine(io, `=== DataCore scraper ===`);
      writeLine(io, `  Game version:  ${gameVersion} (${channel.toUpperCase()})`);
      writeLine(io, `  DCB source:    ${dcbPath}`);
      writeLine(io, `  XML cache:     ${xmlCacheDir}`);
      writeLine(io, `  CSV output:    ${outputBase}`);
      writeLine(io, `  Types:         ${selectedTypes.length} of ${allTypes.length}`);
      writeLine(io, `  Dry run:       ${dryRun ? 'yes' : 'no'}`);
      writeLine(io);
    },
    onToolsLog: (message) => writeLine(io, `[tools] ${message}`),
    onToolsReady: (tools) => {
      writeLine(io, `  unforge: ${tools.unforge}`);
      writeLine(io);
    },
    onCacheHit: (count, xmlCacheDir) => {
      writeLine(io, `Using XML cache: ${count.toLocaleString()} files`);
      writeLine(io, `  (${xmlCacheDir})`);
      writeLine(io, '  Run with --force-extract to re-run unforge.\n');
      renderer.emit({ type: 'progress:start', id: 'datacore-cache', label: 'DataCore', total: count, value: count });
      renderer.emit({ type: 'progress:update', id: 'datacore-cache', value: count, label: 'unforge (cached)' });
      renderer.emit({ type: 'progress:stop', id: 'datacore-cache' });
      writeLine(io);
    },
    onCacheExtractStart: (dcbPath, xmlCacheDir, clearExisting) => {
      if (clearExisting) {
        writeLine(io, '--force-extract: clearing existing cache...');
      }
      writeLine(io, `Extracting DataForge records from ${path.basename(dcbPath)}...`);
      writeLine(io, '  This takes several minutes on first run.\n');
      writeLine(io, `  Running: unforge.cli.exe "${xmlCacheDir}"`);
      renderer.emit({
        type: 'activity:start',
        id: 'datacore-unforge',
        label: 'Unforge',
        detail: 'extracting XML records...',
      });
    },
    onCacheExtractProgress: (count) => {
      renderer.emit({ type: 'activity:update', id: 'datacore-unforge', count, unit: 'XMLs extracted' });
    },
    onCacheExtractComplete: (count) => {
      renderer.emit({ type: 'activity:stop', id: 'datacore-unforge', count, unit: 'XMLs extracted' });
      writeLine(io, `  Extraction complete: ${count.toLocaleString()} XML records cached.\n`);
    },
    onRecordGraphStart: (total) => {
      writeLine(io, `Building DataCore record graph (parsing ${total} XML files)...`);
      renderer.emit({ type: 'progress:start', id: 'datacore-graph', label: 'DataCore', total });
      renderer.emit({ type: 'progress:update', id: 'datacore-graph', value: 0, label: 'record-graph' });
    },
    onRecordGraphProgress: (current, total) => {
      renderer.emit({ type: 'progress:update', id: 'datacore-graph', value: current, total });
      if (current >= total) {
        renderer.emit({ type: 'progress:stop', id: 'datacore-graph' });
        writeLine(io);
      }
    },
    onRecordGraphCacheHit: (_recordCount, outputPath) => {
      writeLine(io, `Using cached DataCore record graph from ${path.basename(outputPath)}...`);
      writeLine(io);
    },
    onRawFactStart: (slug, total) => {
      renderer.emit({ type: 'progress:stop', id: 'datacore-scrape' });
      renderer.emit({ type: 'progress:start', id: 'datacore-scrape', label: 'DataCore', total });
      renderer.emit({ type: 'progress:update', id: 'datacore-scrape', value: 0, label: slug });
    },
    onRawFactProgress: (current) => {
      renderer.emit({ type: 'progress:update', id: 'datacore-scrape', value: current });
    },
    onTypeStart: (entry, index) => {
      if (index === 0) {
        renderer.emit({ type: 'progress:stop', id: 'datacore-scrape' });
        renderer.emit({
          type: 'progress:start',
          id: 'datacore-scrape',
          label: 'DataCore',
          total: selectedTypes.length,
        });
      }
      renderer.emit({ type: 'progress:update', id: 'datacore-scrape', value: index, label: entry.name });
    },
  });

  if (selectedTypes.length > 0) {
    renderer.emit({ type: 'progress:update', id: 'datacore-scrape', value: selectedTypes.length });
    renderer.emit({ type: 'progress:stop', id: 'datacore-scrape' });
  }
  renderer.stopAll();

  writeLine(io, '\n=== Results ===');
  const dryNote = values['dry-run'] ? ' (dry run, not written)' : '';
  writeLine(io, 'DataCore raw fact datasets:');
  for (const rawFact of result.rawFactResults) {
    printDatasetResult(io, rawFact.slug, rawFact.rows, rawFact.csvFile, dryNote);
  }
  writeLine(io, 'DataCore mining fact datasets:');
  printDatasetResult(
    io,
    'mining-elements',
    result.miningElementResult.rows,
    result.miningElementResult.csvFile,
    dryNote,
  );
  printDatasetResult(
    io,
    'mining-compositions',
    result.miningCompositionResult.rows,
    result.miningCompositionResult.csvFile,
    dryNote,
  );
  printDatasetResult(
    io,
    'mineable-entities',
    result.mineableEntityResult.rows,
    result.mineableEntityResult.csvFile,
    dryNote,
  );
  printDatasetResult(
    io,
    'mining-density-overrides',
    result.miningDensityOverrideResult.rows,
    result.miningDensityOverrideResult.csvFile,
    dryNote,
  );
  printDatasetResult(
    io,
    'mining-clustering',
    result.miningClusteringResult.rows,
    result.miningClusteringResult.csvFile,
    dryNote,
  );
  printDatasetResult(
    io,
    'mining-harvestable-presets',
    result.miningHarvestablePresetResult.rows,
    result.miningHarvestablePresetResult.csvFile,
    dryNote,
  );
  printDatasetResult(
    io,
    'mining-harvestable-setups',
    result.miningHarvestableSetupResult.rows,
    result.miningHarvestableSetupResult.csvFile,
    dryNote,
  );
  printDatasetResult(
    io,
    'mining-sub-harvestable-configs',
    result.miningSubHarvestableConfigResult.rows,
    result.miningSubHarvestableConfigResult.csvFile,
    dryNote,
  );
  printDatasetResult(
    io,
    'mining-quality-distributions',
    result.miningQualityDistributionResult.rows,
    result.miningQualityDistributionResult.csvFile,
    dryNote,
  );
  printDatasetResult(
    io,
    'mining-quality-quantizations',
    result.miningQualityQuantizationResult.rows,
    result.miningQualityQuantizationResult.csvFile,
    dryNote,
  );
  printDatasetResult(io, 'mining-params', result.miningParamResult.rows, result.miningParamResult.csvFile, dryNote);
  printDatasetResult(
    io,
    'mining-provider-presets',
    result.miningProviderPresetResult.rows,
    result.miningProviderPresetResult.csvFile,
    dryNote,
  );
  for (const row of result.results) {
    printDatasetResult(io, row.type, row.rows, row.csvFile, dryNote, row.skipped);
  }

  if (result.errors.length > 0) {
    writeErrorLine(io, '\n=== Errors ===');
    for (const error of result.errors) {
      writeErrorLine(io, `  ${error.type}: ${error.message}`);
    }
  }

  if (!values['dry-run']) {
    writeLine(io, `\nCSV output:  ${result.outputBase}`);
  }
  writeLine(io, `XML cache:   ${result.xmlCacheDir}`);
  writeLine(io, '\n=== Done ===');

  return result.exitCode;
}
