import path from 'node:path';
import fs from 'node:fs/promises';
import { parseArgs } from 'node:util';
import cliProgress from 'cli-progress';
import { loadMissionConfigs, loadSpviewerConfigs } from '../src/items/registry.js';
import { backupIniFile } from '../src/lib/io/ini-file.js';
import { getLogger, setJsonOutput, setLogLevel, shutdownLogger } from '../src/lib/logger.js';
import { runUpdate } from '../src/lib/updater.js';

const logger = getLogger('update-all');

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { error: String(reason) });
  process.exit(1);
});

const { values } = parseArgs({
  options: {
    'ini-path': { type: 'string', short: 'i' },
    'csv-dir': { type: 'string', short: 'c' },
    'dry-run': { type: 'boolean', default: false },
    ptu: { type: 'boolean', default: false },
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
  console.log('  -c, --csv-dir <path>   Directory containing CSV files (default: auto-detected from latest scraped version)');
  console.log('      --dry-run          Preview changes without writing');
  console.log('      --ptu              Use latest PTU scraped data instead of latest LIVE');
  console.log('  -v, --verbose          Enable verbose logging');
  console.log('      --json-logs        Output logs as JSON (for log aggregation)');
  console.log('  -h, --help             Show this help message');
  process.exit(0);
}

if (values.verbose) setLogLevel('debug');
if (values['json-logs']) setJsonOutput(true);

/**
 * Finds the latest versioned subfolder under csv/scmdb/ that matches the
 * requested channel (live or ptu). Folder names come from SCMDB version
 * strings, e.g. "4.1.1-live.9800000" or "4.2.0-ptu.9900000".
 *
 * @param {string} scmdbBase - absolute path to csv/scmdb/
 * @param {boolean} ptu      - true to look for PTU versions, false for LIVE
 * @returns {Promise<string>} - absolute path to the best matching version folder
 */
async function resolveLatestVersionDir(scmdbBase, ptu) {
  let entries;
  try {
    entries = await fs.readdir(scmdbBase, { withFileTypes: true });
  } catch {
    throw new Error(`SCMDB output directory not found: ${scmdbBase}. Run scrape-scmdb.js${ptu ? ' --ptu' : ''} first.`);
  }

  const isMatch = ptu
    ? (name) => /\bptu\b/i.test(name) || /-ptu\./i.test(name)
    : (name) => /\blive\b/i.test(name) || /-live\./i.test(name);

  const dirs = entries
    .filter((e) => e.isDirectory() && isMatch(e.name))
    .map((e) => e.name)
    .sort(); // lexicographic sort works well for semver-like version strings

  if (dirs.length === 0) {
    throw new Error(
      `No ${ptu ? 'PTU' : 'LIVE'} SCMDB version folder found under ${scmdbBase}. ` +
      `Run scrape-scmdb.js${ptu ? ' --ptu' : ''} first.`
    );
  }

  // Use the last (latest) matching directory.
  return path.join(scmdbBase, dirs[dirs.length - 1]);
}

const repoRoot = path.resolve(import.meta.dirname, '..');

// If --csv-dir is provided explicitly, use it as-is for all categories.
// Otherwise auto-detect the latest versioned SCMDB folder.
let csvDir;
let scmdbVersion = '(custom)';

if (values['csv-dir']) {
  csvDir = values['csv-dir'];
} else {
  const scmdbBase = path.join(repoRoot, 'csv', 'scmdb');
  const versionDir = await resolveLatestVersionDir(scmdbBase, values.ptu);
  csvDir = versionDir;
  scmdbVersion = path.basename(versionDir);
}

const options = {
  iniPath: values['ini-path'],
  csvDir,
  dryRun: values['dry-run'],
};

const channel = values.ptu ? 'PTU' : 'LIVE';
logger.info('Starting batch update', { version: scmdbVersion, channel, dryRun: options.dryRun });
console.log(`=== Starting update — SCMDB version: ${scmdbVersion} (${channel}) ===\n`);

// SPViewer configs reference files like "spviewer/cooler.spviewer.csv" relative
// to the repo-root csv/ folder — they are not SCMDB-sourced and must not be
// redirected into the version dir.
// Mission configs live inside the versioned SCMDB folder under a missions/ subdir.
// If the caller provided --csv-dir explicitly we honour it for missions as well
// (they can put everything in one flat dir if they prefer).
const repoCsvDir = path.join(repoRoot, 'csv');
const missionCsvDir = path.join(csvDir, 'missions');

const spviewerConfigs = [...(await loadSpviewerConfigs()).values()];
const missionConfigs = [...(await loadMissionConfigs()).values()];

// Tag each config with the csvDir it should use.
const categories = [
  ...spviewerConfigs.map((cfg) => ({ config: cfg, csvDir: repoCsvDir })),
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
    errors.push({ label: config.label, message: err.message });
    logger.error('Failed to update category', {
      label: config.label,
      error: err.message,
      cause: err.cause?.message,
    });
  }
}

bar.update(categories.length, { category: 'Done' });
bar.stop();

const totalDuration = Math.round(performance.now() - totalStart);

console.log();
for (const r of results) console.log(r.summary);

const allIssues = results.flatMap((r) => r.issues.map((i) => ({ label: r.label, ...i })));
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
