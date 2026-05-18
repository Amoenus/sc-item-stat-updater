import path from 'node:path';
import { inspect, parseArgs } from 'node:util';
import cliProgress from 'cli-progress';
import { type Artifact, writeArtifactFile } from '../src/artifact/artifact.js';
import { findLatestMatchingDirectory } from '../src/io/local/discovery.js';
import { backupIniFile } from '../src/io/local/ini-file.js';
import { loadMissionConfigs, loadSpviewerConfigs } from '../src/items/registry.js';
import { getLogger, setJsonOutput, setLogLevel, shutdownLogger } from '../src/lib/logger.js';
import { runUpdate } from '../src/lib/updater.js';
import { runComponentTitleUpdate } from '../src/lib/updates/component-titles.js';
import { runFpsTitleTagUpdate } from '../src/lib/updates/fps-title-tags.js';
import { runMissileTitleTagUpdate } from '../src/lib/updates/missile-title-tags.js';
import { runMissingStringsUpdate } from '../src/lib/updates/missing-strings.js';
import { runRawCommodityLabelFixUpdate } from '../src/lib/updates/raw-commodity-label-fixes.js';
import { regenMiningLocations } from './regen-mining-locations.js';

const logger = getLogger('update-all');

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { error: inspect(reason, { depth: 3 }) });
  process.exit(1);
});

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

if (values.verbose) setLogLevel('debug');
if (values['json-logs']) setJsonOutput(true);

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

const bar = new cliProgress.SingleBar({
  format: '{bar} {percentage}% | {value}/{total} | {category}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true,
});

const results = [];
const errors = [];

bar.start(categories.length, 0, { category: '' });

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

bar.update(categories.length, { category: 'Done' });
bar.stop();

try {
  logger.info('Starting component title update');
  const miningResult = await runComponentTitleUpdate({
    iniPath,
    spviewerDir: spviewerVersionDir,
    dryRun: options.dryRun,
  });
  results.push(miningResult);
  logger.info('Component title update complete', {
    updatedCount: miningResult.updatedCount,
    matchedCount: miningResult.matchedCount,
    scannedCount: miningResult.scannedCount,
    dryRun: options.dryRun,
  });
} catch (err) {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('Failed to update component titles', { error: error.message });
  errors.push({ label: 'Component Titles', message: error.message });
}

try {
  logger.info('Starting FPS title tag update');
  const fpsTagResult = await runFpsTitleTagUpdate({
    iniPath,
    spviewerDir: spviewerVersionDir,
    dryRun: options.dryRun,
  });
  results.push(fpsTagResult);
  logger.info('FPS title tag update complete', {
    updatedCount: fpsTagResult.updatedCount,
    matchedCount: fpsTagResult.matchedCount,
    scannedCount: fpsTagResult.scannedCount,
    dryRun: options.dryRun,
  });
} catch (err) {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('Failed to update FPS title tags', { error: error.message });
  errors.push({ label: 'FPS title tags', message: error.message });
}

try {
  logger.info('Starting missile title tag update');
  const missileTagResult = await runMissileTitleTagUpdate({
    iniPath,
    spviewerDir: spviewerVersionDir,
    repoRoot,
    dryRun: options.dryRun,
  });
  results.push(missileTagResult);
  logger.info('Missile title tag update complete', {
    updatedCount: missileTagResult.updatedCount,
    matchedCount: missileTagResult.matchedCount,
    scannedCount: missileTagResult.scannedCount,
    dryRun: options.dryRun,
  });
} catch (err) {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('Failed to update missile title tags', { error: error.message });
  errors.push({ label: 'Missile title tags', message: error.message });
}

if (values['include-mining-journal']) {
  try {
    const { runMiningJournalUpdate } = await import('../src/lib/updates/mining-journal-update.js');
    const miningJournalResult = await runMiningJournalUpdate({
      iniPath,
      missionCsvDir,
      dryRun: options.dryRun,
    });
    if (miningJournalResult) {
      results.push(miningJournalResult);
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Failed to update Mining journal', { error: error.message });
    errors.push({ label: 'Mining journal', message: error.message });
  }
}

try {
  const rawCommodityLabelResult = await runRawCommodityLabelFixUpdate({
    iniPath,
    dryRun: options.dryRun,
  });
  results.push(rawCommodityLabelResult);
} catch (err) {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('Failed to apply raw commodity label fixes', { error: error.message });
  errors.push({ label: 'Raw commodity labels', message: error.message });
}

try {
  const missingStringsResult = await runMissingStringsUpdate({
    iniPath,
    patchPath: path.join(repoRoot, 'missing-strings.ini'),
    dryRun: options.dryRun,
  });
  results.push(missingStringsResult);
} catch (err) {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('Failed to insert missing strings', { error: error.message });
  errors.push({ label: 'Missing strings', message: error.message });
}

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
      label: r.label as string,
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

console.log();
for (const r of results) console.log(r.summary);

const allIssues = results.flatMap((r) =>
  ((r.issues ?? []) as Array<{ key: string; reason: string; type: string }>).map((i) => ({
    label: r.label as string,
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

logger.debug('Batch update complete', {
  totalDuration,
  successCount: results.length,
  errorCount: errors.length,
});

await shutdownLogger();

if (errors.length > 0) process.exit(1);
