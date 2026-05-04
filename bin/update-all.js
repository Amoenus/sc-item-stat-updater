import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import cliProgress from 'cli-progress';
import { loadMissionConfigs, loadSpviewerConfigs } from '../src/items/registry.js';
import { parseCSV } from '../src/lib/io/csv-parser.js';
import { backupIniFile, readIniFile, writeIniFile } from '../src/lib/io/ini-file.js';
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
  console.log(
    '  -c, --csv-dir <path>   Directory containing CSV files (default: auto-detected from latest scraped version)',
  );
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
async function resolveLatestVersionDir(base, ptu, source, scraper) {
  let entries;
  try {
    entries = await fs.readdir(base, { withFileTypes: true });
  } catch {
    throw new Error(`${source} output directory not found: ${base}. Run ${scraper}${ptu ? ' --ptu' : ''} first.`);
  }

  const isMatch = ptu
    ? (name) => /\bptu\b/i.test(name) || /-ptu[.\b]/i.test(name) || name.endsWith('-ptu')
    : (name) => /\blive\b/i.test(name) || /-live[.\b]/i.test(name) || name.endsWith('-live');

  const dirs = entries
    .filter((e) => e.isDirectory() && isMatch(e.name))
    .map((e) => e.name)
    .sort(); // lexicographic sort works well for semver-like version strings

  if (dirs.length === 0) {
    throw new Error(
      `No ${ptu ? 'PTU' : 'LIVE'} ${source} version folder found under ${base}. ` +
        `Run ${scraper}${ptu ? ' --ptu' : ''} first.`,
    );
  }

  // Use the last (latest) matching directory.
  return path.join(base, dirs[dirs.length - 1]);
}

const MINING_CLASS_ABBREV = {
  Stealth: 'Sth',
  Industrial: 'Ind',
  Civilian: 'Civ',
  Competition: 'Cmp',
  Military: 'Mil',
};

const COMPONENT_NAME_LINE_PATTERN = /^(item_name_?.*?)=(.*)$/i;
const PREFIXED_COMPONENT_NAME_PATTERN = /^\S+\s+(.+)$/u;

function normalizeSpaces(value) {
  return String(value || '')
    .replaceAll(/[\u00a0\u202f]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function getMiningPrefix(cls, size, grade) {
  const abbr = MINING_CLASS_ABBREV[cls] || (cls ? cls.slice(0, 3) : '???');
  return `${abbr}/${size}/${grade}`;
}

async function buildMiningTitleLookup(spviewerDir) {
  const files = (await fs.readdir(spviewerDir)).filter((name) => name.endsWith('.spviewer.csv')).sort();
  const nameToPrefix = new Map();

  for (const filename of files) {
    const filePath = path.join(spviewerDir, filename);
    const csvText = await fs.readFile(filePath, 'utf-8');
    const rows = parseCSV(csvText);

    for (const row of rows) {
      const name = normalizeSpaces(row.Name || '');
      if (!name) continue;
      const cls = (row.Class || '').trim();
      const size = (row.Size || '').trim();
      const grade = (row.Grade || '').trim();
      nameToPrefix.set(name.toLowerCase(), {
        name,
        prefix: getMiningPrefix(cls, size, grade),
      });
    }
  }

  return { files, nameToPrefix };
}

function resolveBaseName(currentValue, nameToPrefix) {
  const normalized = normalizeSpaces(currentValue);
  if (!normalized) return null;

  const exact = nameToPrefix.get(normalized.toLowerCase());
  if (exact) return exact;

  const prefixed = PREFIXED_COMPONENT_NAME_PATTERN.exec(normalized);
  if (prefixed) {
    const base = nameToPrefix.get(prefixed[1].toLowerCase());
    if (base) return base;
  }

  return null;
}

function applyMiningTitlePrefixes(lines, nameToPrefix) {
  const updatedLines = [];
  let scannedCount = 0;
  let matchedCount = 0;
  let updatedCount = 0;

  for (const line of lines) {
    const match = COMPONENT_NAME_LINE_PATTERN.exec(line);
    if (!match) {
      updatedLines.push(line);
      continue;
    }

    scannedCount++;
    const key = match[1];
    const currentValue = match[2];
    const base = resolveBaseName(currentValue, nameToPrefix);

    if (!base) {
      updatedLines.push(line);
      continue;
    }

    matchedCount++;
    const newValue = `${base.prefix} ${base.name}`;
    if (newValue === currentValue) {
      updatedLines.push(line);
      continue;
    }

    updatedLines.push(`${key}=${newValue}`);
    updatedCount++;
  }

  return { updatedLines, scannedCount, matchedCount, updatedCount };
}

async function runMiningTitleUpdate(iniPath, spviewerDir, dryRun) {
  const { files, nameToPrefix } = await buildMiningTitleLookup(spviewerDir);

  logger.info('Loaded mining title lookup data', {
    csvFileCount: files.length,
    componentCount: nameToPrefix.size,
  });

  const iniText = await fs.readFile(iniPath, 'utf-8');
  const lines = iniText.replace(/^\ufeff/, '').split(/\r?\n/);
  const { updatedLines, scannedCount, matchedCount, updatedCount } = applyMiningTitlePrefixes(lines, nameToPrefix);

  if (!dryRun && updatedCount > 0) {
    await writeIniFile(iniPath, updatedLines, { skipBackup: true });
  }

  const durationMs = 0;
  return {
    label: 'Component Titles',
    updatedCount,
    matchedCount,
    scannedCount,
    issues: [],
    summary: `Component Titles: Updated ${updatedCount}, Matched ${matchedCount}, Scanned ${scannedCount}${dryRun ? ' (dry run)' : ''} [${durationMs}ms]`,
  };
}

const repoRoot = path.resolve(import.meta.dirname, '..');

// Resolve versioned SCMDB directory (or use --csv-dir override for SCMDB).
let csvDir;
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

try {
  logger.info('Starting component title update');
  const miningStart = performance.now();
  const miningResult = await runMiningTitleUpdate(iniPath, spviewerVersionDir, options.dryRun);
  const miningDuration = Math.round(performance.now() - miningStart);
  miningResult.summary = `Component Titles: Updated ${miningResult.updatedCount}, Matched ${miningResult.matchedCount}, Scanned ${miningResult.scannedCount}${options.dryRun ? ' (dry run)' : ''} [${miningDuration}ms]`;
  results.push(miningResult);
  logger.info('Component title update complete', {
    updatedCount: miningResult.updatedCount,
    matchedCount: miningResult.matchedCount,
    scannedCount: miningResult.scannedCount,
    durationMs: miningDuration,
    dryRun: options.dryRun,
  });
} catch (err) {
  logger.error('Failed to update component titles', { error: err.message });
  errors.push({ label: 'Component Titles', message: err.message });
}

// === Mining Journal (single-key full-rewrite, handled outside the standard loop) ===
try {
  const journalCsvPath = path.join(missionCsvDir, 'mining-journal.csv');
  await fs.access(journalCsvPath);
  const { buildJournalValue } = await import('../src/items/missions/mining-journal.js');
  const journalStart = performance.now();
  const journalCsvText = await fs.readFile(journalCsvPath, 'utf-8');
  const journalRows = parseCSV(journalCsvText);
  const { lines: journalLines, index: journalIdx } = await readIniFile(iniPath);
  const JOURNAL_KEY = 'Journal_General_Mining_Compendium_Content';
  const matchKey = Object.keys(journalIdx).find(
    (k) => k.toLowerCase() === JOURNAL_KEY.toLowerCase(),
  );
  if (matchKey !== undefined) {
    const oldLine = journalLines[journalIdx[matchKey]];
    const eqIdx = oldLine.indexOf('=');
    const oldValue = eqIdx > -1 ? oldLine.substring(eqIdx + 1) : '';
    const newValue = buildJournalValue(journalRows, oldValue);
    const journalDuration = Math.round(performance.now() - journalStart);
    const updated = newValue !== oldValue;
    if (updated && !options.dryRun) {
      journalLines[journalIdx[matchKey]] = `${matchKey}=${newValue}`;
      await writeIniFile(iniPath, journalLines, { skipBackup: true });
    }
    results.push({
      label: 'Mining journal',
      issues: [],
      summary: `Mining journal: Updated ${updated ? 1 : 0}, Matched 1 [${journalDuration}ms]`,
    });
    logger.info('Mining journal update complete', { updated, durationMs: journalDuration });
  } else {
    logger.warn('Mining journal: key not found in INI', { key: JOURNAL_KEY });
  }
} catch (err) {
  if (err.code !== 'ENOENT') {
    logger.error('Failed to update Mining journal', { error: err.message });
    errors.push({ label: 'Mining journal', message: err.message });
  }
}

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
