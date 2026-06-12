import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  createDataCoreScrapePlan,
  loadDataCoreTypeEntries,
  type RunDatacoreScrapeResult,
} from '../../application/use-cases/run-datacore-scrape';
import { type CommandIO, defaultCommandIO, writeErrorLine, writeLine } from '../cli';
import { createDataCoreScrapeTask } from '../datacore-task';
import { createCommandTaskList } from '../task-list';

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

interface ScrapeDatacoreTaskContext {
  result?: RunDatacoreScrapeResult;
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

  try {
    for (const name of positionals) {
      if (!allTypes.some((type) => type.name === name)) {
        throw new Error(`Unknown item type: "${name}". Run with --list to see valid types.`);
      }
    }
  } catch (error) {
    writeErrorLine(io, error instanceof Error ? error.message : String(error));
    return 1;
  }

  const context: ScrapeDatacoreTaskContext = {};
  const taskList = createCommandTaskList(
    [
      createDataCoreScrapeTask<ScrapeDatacoreTaskContext>({
        title: 'Scrape DataCore',
        repoRoot: REPO_ROOT,
        binDirname: path.join(REPO_ROOT, 'bin'),
        ptu: values.ptu,
        dryRun: values['dry-run'],
        forceExtract: values['force-extract'],
        types: positionals,
        loadTypes: async () => allTypes,
        planFactory: createDataCoreScrapePlan,
        onResult: (result) => {
          context.result = result;
        },
      }),
    ],
    io,
    context,
  );

  try {
    await taskList.run();
  } catch (error) {
    writeErrorLine(io, error instanceof Error ? error.message : String(error));
    return 1;
  }

  const result = context.result;
  if (!result) throw new Error('DataCore scraper did not produce a result.');

  writeLine(io, '\n=== Results ===');
  writeLine(io, `Detected game version: ${result.gameVersion}`);
  writeLine(io, `DataCore output version: ${result.versionTag}`);
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
