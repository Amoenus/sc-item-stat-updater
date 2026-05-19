import path from 'node:path';
import { parseArgs } from 'node:util';
import cliProgress from 'cli-progress';
import { type Artifact, writeArtifactFile } from '../src/artifact/artifact';
import { findLatestMatchingDirectory } from '../src/io/local/discovery';
import { backupIniFile } from '../src/io/local/ini-file';
import { loadMissionConfigs, loadSpviewerConfigs } from '../src/items/registry';
import { applyLogFlags, registerUnhandledRejectionHandler } from '../src/lib/cli';
import { getLogger, shutdownLogger } from '../src/lib/logger';
import { runUpdate } from '../src/lib/updater';
import { runComponentTitleUpdate } from '../src/lib/updates/component-titles';
import { runFpsTitleTagUpdate } from '../src/lib/updates/fps-title-tags';
import { runMissileTitleTagUpdate } from '../src/lib/updates/missile-title-tags';
import { runAdagioLocationTagUpdate } from '../src/lib/updates/adagio-location-tags';
import { runRawCommodityLabelFixUpdate } from '../src/lib/updates/raw-commodity-label-fixes';
import { regenMiningLocations } from './regen-mining-locations';

const logger = getLogger('update-all');

registerUnhandledRejectionHandler(logger);

type StepError = { label: string; message: string };
type AnyUpdateResult = { label: string; summary: string; patches?: Record<string, string>; issues?: unknown[] };

async function runStep(
  label: string,
  results: AnyUpdateResult[],
  errors: StepError[],
  fn: () => Promise<AnyUpdateResult | null | undefined>,
): Promise<void> {
  try {
    const result = await fn();
    if (result != null) results.push(result);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    errors.push({ label, message: error.message });
    logger.error(`Failed: ${label}`, { error: error.message });
  }
}

function printSummary(results: AnyUpdateResult[], errors: StepError[], totalDuration: number): void {
  console.log();
  for (const r of results) console.log(r.summary);

  const allIssues = results.flatMap((r) =>
    ((r.issues ?? []) as Array<{ key: string; reason: string; type: string }>).map((i) => ({
      label: r.label,
      ...i,
    })),
  );
  if (allIssues.length > 0) {
    console.log('\n⚠ Problem rows:');
    for (const issue of allIssues) {
      const tag = issue.type ? `${issue.type.toUpperCase()} | ` : '';
      console.log(`  ${issue.label} | ${tag}${issue.key} — ${issue.reason}`);
    }
  }

  for (const e of errors) console.error(`ERROR in ${e.label}: ${e.message}`);
  console.log(`\n=== All updates complete [${totalDuration}ms] ===`);
}

const { values } = parseArgs({
  options: {
    'ini-path': { type: 'string', short: 'i' },
    'csv-dir': { type: 'string', short: 'c' },
    'dry-run': { type: 'boolean', default: false },
    'emit-artifact': { type: 'string' },
    ptu: { type: 'boolean', default: false },
    'include-mining-journal': { type: 'boolean', default: false },
    verbose: { type: 'boolean', short: 'v', default: false },
    'json-logs': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
});

if (values.help) {
  console.log('Usage: node update-all.js [options]');
  console.log('\nOptions:');
  console.log('  -i, --ini-path <path>  Path to global.ini (default: ./global.ini)');
  console.log(
    '  -c, --csv-dir <path>   Directory containing CSV files (default: auto-detected from latest scraped version)',
  );
  console.log('      --dry-run          Preview changes without writing');
  console.log('      --emit-artifact <path>  Write a patch artifact JSON to the given path (ADR 002)');
  console.log('      --ptu              Use latest PTU scraped data instead of latest LIVE');
  console.log('      --include-mining-journal  Also update mining compendium journal entry');
  console.log('  -v, --verbose          Enable verbose logging');
  console.log('      --json-logs        Output logs as JSON (for log aggregation)');
  console.log('  -h, --help             Show this help message');
  process.exit(0);
}

applyLogFlags(values);

/**
 * Finds the latest versioned subfolder under a base directory that matches
 * the requested channel (live or ptu).
 *
 * SCMDB folders:   "4.1.1-live.9800000" or "4.2.0-ptu.9900000"
 * SPViewer folders: "4.7.2.11715810-live" or "4.8.0.11768487-ptu"
 *
 * @param {string} base   - absolute path to the parent directory
 * @param {boolean} ptu   - true to look for PTU versions, false for LIVE
 * @param {string} source - label used in error messages (e.g. "SCMDB", "SPViewer")
 * @param {string} scraper - name of the scraper script to suggest in error messages
 * @returns {Promise<string>} - absolute path to the best matching version folder
 */
async function resolveLatestVersionDir(base: string, ptu: boolean, source: string, scraper: string): Promise<string> {
  const isMatch = ptu
    ? (name: string) => /\bptu\b/i.test(name) || /-ptu[.\b]/i.test(name) || name.endsWith('-ptu')
    : (name: string) => /\blive\b/i.test(name) || /-live[.\b]/i.test(name) || name.endsWith('-live');

  return findLatestMatchingDirectory(base, isMatch, {
    label: `${source} output directory`,
    notFoundMessage: `${source} output directory not found: ${base}. Run ${scraper}${ptu ? ' --ptu' : ''} first.`,
    noMatchMessage:
      `No ${ptu ? 'PTU' : 'LIVE'} ${source} version folder found under ${base}. ` +
      `Run ${scraper}${ptu ? ' --ptu' : ''} first.`,
  });
}

const repoRoot = path.resolve(import.meta.dirname, '..');

// Resolve versioned SCMDB directory (or use --csv-dir override for SCMDB).
let csvDir: string;
let scmdbVersion = '(custom)';

if (values['csv-dir']) {
  csvDir = values['csv-dir'];
} else {
  const scmdbBase = path.join(repoRoot, 'csv', 'scmdb');
  const versionDir = await resolveLatestVersionDir(scmdbBase, values.ptu, 'SCMDB', 'scrape-scmdb.js');
  csvDir = versionDir;
  scmdbVersion = path.basename(versionDir);
}

// Resolve versioned SPViewer directory (always auto-detected — no override flag for now).
const spviewerBase = path.join(repoRoot, 'csv', 'spviewer');
const spviewerVersionDir = await resolveLatestVersionDir(spviewerBase, values.ptu, 'SPViewer', 'scrape-spviewer.js');
const spviewerVersion = path.basename(spviewerVersionDir);

const options = {
  iniPath: values['ini-path'],
  csvDir,
  dryRun: values['dry-run'],
};

const channel = values.ptu ? 'PTU' : 'LIVE';
logger.info('Starting batch update', { scmdbVersion, spviewerVersion, channel, dryRun: options.dryRun });
console.log(`=== Starting update (${channel}) ===`);
console.log(`  SCMDB:    ${scmdbVersion}`);
console.log(`  SPViewer: ${spviewerVersion}\n`);

// SPViewer configs: use the versioned spviewer directory.
// Mission configs: use the versioned SCMDB root directory. Individual configs
//   are responsible for their own subdirectory paths (e.g. scmdb.js uses
//   csvFile: 'missions/scmdb-missions.csv', commodities.js globs merged-*.json
//   at the root level via resolveJsonFile).
const missionCsvDir = csvDir;

try {
  logger.info('Regenerating mining-locations.csv', { missionCsvDir });
  regenMiningLocations({
    scmdbDir: missionCsvDir,
    log: (message: string) => logger.debug(message),
  });
} catch (err) {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('Failed to regenerate mining-locations.csv', { error: error.message });
  await shutdownLogger();
  process.exit(1);
}

const spviewerConfigs = [...(await loadSpviewerConfigs()).values()];
const missionConfigs = [...(await loadMissionConfigs()).values()].filter((c) => !c.skip);

// Tag each config with the csvDir it should use.
const categories = [
  ...spviewerConfigs.map((cfg) => ({ config: cfg, csvDir: spviewerVersionDir })),
  ...missionConfigs.map((cfg) => ({ config: cfg, csvDir: missionCsvDir })),
];

const totalStart = performance.now();
logger.debug('Starting batch update', { categoryCount: categories.length, dryRun: options.dryRun });
console.log('=== Updating all item descriptions ===\n');

const iniPath = options.iniPath || path.join(repoRoot, 'global.ini');
if (!options.dryRun) {
  await backupIniFile(iniPath);
  logger.debug('Created global.ini backup before batch update');
}
const sharedOptions = { ...options, skipBackup: true };

const fixedExtraSteps = [
  'Component Titles',
  'FPS title tags',
  'Missile title tags',
  'Raw commodity labels',
  'Adagio location tags (experimental)',
] as const;
const extraSteps = fixedExtraSteps.length + (values['include-mining-journal'] ? 1 : 0);
const bar = new cliProgress.SingleBar({
  format: '{bar} {percentage}% | {value}/{total} | {category}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true,
});

const results: AnyUpdateResult[] = [];
const errors: StepError[] = [];

bar.start(categories.length + extraSteps, 0, { category: '' });

for (let i = 0; i < categories.length; i++) {
  const { config, csvDir: entryCsvDir } = categories[i];
  bar.update(i, { category: config.label });
  try {
    results.push(await runUpdate(config, { ...sharedOptions, csvDir: entryCsvDir }));
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    errors.push({ label: config.label, message: error.message });
    logger.error('Failed to update category', {
      label: config.label,
      error: error.message,
      cause: err instanceof Error && 'cause' in err && err.cause instanceof Error ? err.cause.message : undefined,
    });
  }
}

let barStep = categories.length;
bar.update(barStep, { category: 'Component Titles' });
await runStep('Component Titles', results, errors, async () => {
  logger.info('Starting component title update');
  const result = await runComponentTitleUpdate({
    iniPath,
    spviewerDir: spviewerVersionDir,
    dryRun: options.dryRun,
  });
  logger.info('Component title update complete', {
    updatedCount: result.updatedCount,
    matchedCount: result.matchedCount,
    scannedCount: result.scannedCount,
    dryRun: options.dryRun,
  });
  return result;
});

barStep++;
bar.update(barStep, { category: 'FPS title tags' });
await runStep('FPS title tags', results, errors, async () => {
  logger.info('Starting FPS title tag update');
  const result = await runFpsTitleTagUpdate({
    iniPath,
    spviewerDir: spviewerVersionDir,
    dryRun: options.dryRun,
  });
  logger.info('FPS title tag update complete', {
    updatedCount: result.updatedCount,
    matchedCount: result.matchedCount,
    scannedCount: result.scannedCount,
    dryRun: options.dryRun,
  });
  return result;
});

barStep++;
bar.update(barStep, { category: 'Missile title tags' });
await runStep('Missile title tags', results, errors, async () => {
  logger.info('Starting missile title tag update');
  const result = await runMissileTitleTagUpdate({
    iniPath,
    spviewerDir: spviewerVersionDir,
    repoRoot,
    dryRun: options.dryRun,
  });
  logger.info('Missile title tag update complete', {
    updatedCount: result.updatedCount,
    matchedCount: result.matchedCount,
    scannedCount: result.scannedCount,
    dryRun: options.dryRun,
  });
  return result;
});

barStep++;

if (values['include-mining-journal']) {
  bar.update(barStep, { category: 'Mining journal' });
  await runStep('Mining journal', results, errors, async () => {
    const { runMiningJournalUpdate } = await import('../src/lib/updates/mining-journal-update.js');
    return runMiningJournalUpdate({ iniPath, missionCsvDir, dryRun: options.dryRun });
  });
  barStep++;
}

bar.update(barStep, { category: 'Raw commodity labels' });
await runStep('Raw commodity labels', results, errors, () =>
  runRawCommodityLabelFixUpdate({ iniPath, dryRun: options.dryRun }),
);

barStep++;
bar.update(barStep, { category: 'Adagio location tags (experimental)' });
await runStep('Adagio location tags (experimental)', results, errors, async () => {
  logger.info('Starting Adagio location tag update (experimental)');
  const result = await runAdagioLocationTagUpdate({ iniPath, dryRun: options.dryRun });
  logger.info('Adagio location tag update complete', {
    updatedCount: result.updatedCount,
    matchedCount: result.matchedCount,
    dryRun: options.dryRun,
  });
  return result;
});

barStep++;
bar.update(barStep, { category: 'Done' });
bar.stop();

const totalDuration = Math.round(performance.now() - totalStart);

// Emit patch artifact if requested (ADR 002).
if (values['emit-artifact']) {
  const artifactPath = path.resolve(values['emit-artifact']);
  const mergedEntries: Record<string, string> = {};
  for (const r of results) {
    if ('patches' in r && r.patches) Object.assign(mergedEntries, r.patches);
  }
  const allIssues = results.flatMap((r) =>
    ((r.issues ?? []) as Array<{ key: string; reason: string; type: string }>).map((i) => ({
      label: r.label,
      ...i,
    })),
  );
  const artifact: Artifact = {
    generatedAt: new Date().toISOString(),
    scmdbVersion: scmdbVersion ?? null,
    spviewerVersion: spviewerVersion ?? null,
    entries: mergedEntries,
    stats: {
      categoryCount: categories.length,
      totalEntries: Object.keys(mergedEntries).length,
      totalSkipped: 0,
      totalErrors: errors.length,
    },
    issues: allIssues,
  };
  try {
    await writeArtifactFile(artifactPath, artifact);
    logger.info('Patch artifact written', { path: artifactPath, entries: artifact.stats.totalEntries });
    console.log(`\n✓ Artifact written → ${artifactPath} (${artifact.stats.totalEntries} entries)`);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Failed to write patch artifact', { error: error.message });
    console.error(`ERROR writing artifact: ${error.message}`);
  }
}

printSummary(results, errors, totalDuration);

logger.debug('Batch update complete', {
  totalDuration,
  successCount: results.length,
  errorCount: errors.length,
});

await shutdownLogger();

if (errors.length > 0) process.exit(1);
