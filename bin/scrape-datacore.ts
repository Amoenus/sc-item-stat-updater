#!/usr/bin/env node
/**
 * scrape-datacore.ts
 *
 * Extracts item stats from the Star Citizen DataForge database (Game*.dcb),
 * parses the resulting entity XML records, and writes one CSV file per item type.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import cliProgress from 'cli-progress';
import {
  type DataCoreTypeEntry,
  loadDataCoreTypeEntries,
  runDatacoreScrape,
} from '../src/application/use-cases/run-datacore-scrape';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const { values, positionals } = parseArgs({
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
  console.log(
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
  process.exit(0);
}

const allTypes = await loadDataCoreTypeEntries(REPO_ROOT);

if (values.list) {
  console.log('Available DataCore item types:');
  for (const type of allTypes) {
    console.log(`  ${type.name.padEnd(28)} filter: ${type.typeConfig.recordFilter}`);
  }
  process.exit(0);
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
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const bar = new cliProgress.SingleBar({
  format: '{bar} {percentage}% | {value}/{total} | {type}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true,
});

const result = await runDatacoreScrape({
  repoRoot: REPO_ROOT,
  binDirname: __dirname,
  ptu: values.ptu,
  dryRun: values['dry-run'],
  forceExtract: values['force-extract'],
  types: positionals,
  loadTypes: async () => allTypes,
  onPrepared: ({ gameVersion, channel, dcbPath, xmlCacheDir, outputBase, dryRun }) => {
    console.log(`=== DataCore scraper ===`);
    console.log(`  Game version:  ${gameVersion} (${channel.toUpperCase()})`);
    console.log(`  DCB source:    ${dcbPath}`);
    console.log(`  XML cache:     ${xmlCacheDir}`);
    console.log(`  CSV output:    ${outputBase}`);
    console.log(`  Types:         ${selectedTypes.length} of ${allTypes.length}`);
    console.log(`  Dry run:       ${dryRun ? 'yes' : 'no'}`);
    console.log();
  },
  onToolsLog: (message) => console.log(`[tools] ${message}`),
  onToolsReady: (tools) => {
    console.log(`  unforge: ${tools.unforge}`);
    console.log();
  },
  onCacheHit: (count, xmlCacheDir) => {
    console.log(`Using XML cache: ${count.toLocaleString()} files`);
    console.log(`  (${xmlCacheDir})`);
    console.log('  Run with --force-extract to re-run unforge.\n');
  },
  onCacheExtractStart: (dcbPath, xmlCacheDir, clearExisting) => {
    if (clearExisting) {
      console.log('--force-extract: clearing existing cache...');
    }
    console.log(`Extracting DataForge records from ${path.basename(dcbPath)}...`);
    console.log('  This takes several minutes on first run.\n');
    console.log(`  Running: unforge.cli.exe "${xmlCacheDir}"`);
  },
  onCacheExtractComplete: (count) => {
    console.log(`  Extraction complete: ${count.toLocaleString()} XML records cached.\n`);
  },
  onRawFactStart: (slug, total) => {
    bar.start(total, 0, { type: slug });
  },
  onRawFactProgress: (current) => {
    bar.update(current);
  },
  onTypeStart: (entry, index) => {
    if (index === 0) bar.start(selectedTypes.length, 0, { type: '' });
    bar.update(index, { type: entry.name });
  },
});

if (selectedTypes.length > 0) {
  bar.update(selectedTypes.length, { type: '' });
  bar.stop();
}

console.log('\n=== Results ===');
const commodityDryNote = values['dry-run'] ? ' (dry run, not written)' : '';
console.log('DataCore raw fact datasets:');
for (const rawFact of result.rawFactResults) {
  console.log(
    `  ${rawFact.slug.padEnd(28)} ${String(rawFact.rows).padStart(4)} rows -> ${rawFact.csvFile}${commodityDryNote}`,
  );
}
console.log('DataCore mining fact datasets:');
console.log(
  `  ${'mining-elements'.padEnd(28)} ${String(result.miningElementResult.rows).padStart(4)} rows -> ${
    result.miningElementResult.csvFile
  }${commodityDryNote}`,
);
console.log(
  `  ${'mining-compositions'.padEnd(28)} ${String(result.miningCompositionResult.rows).padStart(4)} rows -> ${
    result.miningCompositionResult.csvFile
  }${commodityDryNote}`,
);
console.log(
  `  ${'mineable-entities'.padEnd(28)} ${String(result.mineableEntityResult.rows).padStart(4)} rows -> ${
    result.mineableEntityResult.csvFile
  }${commodityDryNote}`,
);
console.log(
  `  ${'mining-density-overrides'.padEnd(28)} ${String(result.miningDensityOverrideResult.rows).padStart(
    4,
  )} rows -> ${result.miningDensityOverrideResult.csvFile}${commodityDryNote}`,
);
console.log(
  `  ${'mining-clustering'.padEnd(28)} ${String(result.miningClusteringResult.rows).padStart(4)} rows -> ${
    result.miningClusteringResult.csvFile
  }${commodityDryNote}`,
);
console.log(
  `  ${'mining-harvestable-presets'.padEnd(28)} ${String(result.miningHarvestablePresetResult.rows).padStart(
    4,
  )} rows -> ${result.miningHarvestablePresetResult.csvFile}${commodityDryNote}`,
);
console.log(
  `  ${'mining-harvestable-setups'.padEnd(28)} ${String(result.miningHarvestableSetupResult.rows).padStart(
    4,
  )} rows -> ${result.miningHarvestableSetupResult.csvFile}${commodityDryNote}`,
);
console.log(
  `  ${'mining-sub-harvestable-configs'.padEnd(28)} ${String(result.miningSubHarvestableConfigResult.rows).padStart(
    4,
  )} rows -> ${result.miningSubHarvestableConfigResult.csvFile}${commodityDryNote}`,
);
console.log(
  `  ${'mining-quality-distributions'.padEnd(28)} ${String(result.miningQualityDistributionResult.rows).padStart(
    4,
  )} rows -> ${result.miningQualityDistributionResult.csvFile}${commodityDryNote}`,
);
console.log(
  `  ${'mining-quality-quantizations'.padEnd(28)} ${String(result.miningQualityQuantizationResult.rows).padStart(
    4,
  )} rows -> ${result.miningQualityQuantizationResult.csvFile}${commodityDryNote}`,
);
console.log(
  `  ${'mining-params'.padEnd(28)} ${String(result.miningParamResult.rows).padStart(4)} rows -> ${
    result.miningParamResult.csvFile
  }${commodityDryNote}`,
);
console.log(
  `  ${'mining-provider-presets'.padEnd(28)} ${String(result.miningProviderPresetResult.rows).padStart(4)} rows -> ${
    result.miningProviderPresetResult.csvFile
  }${commodityDryNote}`,
);
for (const row of result.results) {
  const dryNote = values['dry-run'] ? ' (dry run, not written)' : '';
  const skippedNote = row.skipped > 0 ? ` (${row.skipped} skipped)` : '';
  console.log(
    `  ${row.type.padEnd(28)} ${String(row.rows).padStart(4)} rows -> ${row.csvFile}${dryNote}${skippedNote}`,
  );
}

if (result.errors.length > 0) {
  console.error('\n=== Errors ===');
  for (const error of result.errors) {
    console.error(`  ${error.type}: ${error.message}`);
  }
}

if (!values['dry-run']) {
  console.log(`\nCSV output:  ${result.outputBase}`);
}
console.log(`XML cache:   ${result.xmlCacheDir}`);
console.log('\n=== Done ===');

if (result.exitCode !== 0) process.exit(result.exitCode);
