import path from 'node:path';
import { parseArgs } from 'node:util';
import cliProgress from 'cli-progress';
import { type Artifact, generateArtifact, writeArtifactFile } from '../src/artifact/artifact';
import { enrichGlobalIni } from '../src/application/use-cases/enrich-global-ini';
import {
  prepareUpdateCategories,
  type UpdateProvider,
} from '../src/application/use-cases/prepare-update-categories';
import { backupIniFile } from '../src/io/local/ini-file';
import { applyLogFlags, registerUnhandledRejectionHandler } from '../src/lib/cli';
import { getLogger, shutdownLogger } from '../src/lib/logger';
import { preflightCheckConfigs } from '../src/lib/updater';
import { runAdagioLocationTagUpdate } from '../src/lib/updates/adagio-location-tags';
import { runComponentTitleUpdate } from '../src/lib/updates/component-titles';
import { runFpsTitleTagUpdate } from '../src/lib/updates/fps-title-tags';
import { runMissileTitleTagUpdate } from '../src/lib/updates/missile-title-tags';
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
    provider: { type: 'string', default: 'spviewer' },
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
  console.log('      --provider <name>  Data provider: "spviewer" (default) or "datacore"');
  console.log('  -v, --verbose          Enable verbose logging');
  console.log('      --json-logs        Output logs as JSON (for log aggregation)');
  console.log('  -h, --help             Show this help message');
  process.exit(0);
}

applyLogFlags(values);

const repoRoot = path.resolve(import.meta.dirname, '..');

const providerValue = values.provider ?? 'spviewer';
if (providerValue !== 'spviewer' && providerValue !== 'datacore') {
  console.error(`Unknown --provider "${providerValue}". Valid values: spviewer, datacore`);
  process.exit(1);
}
const provider: UpdateProvider = providerValue;

const { categories, scmdbVersion, itemVersion, missionCsvDir, spviewerVersionDir } = await prepareUpdateCategories({
  repoRoot,
  provider,
  ptu: values.ptu,
  csvDir: values['csv-dir'],
});

const options = {
  iniPath: values['ini-path'],
  csvDir: missionCsvDir,
  dryRun: values['dry-run'],
};

const channel = values.ptu ? 'PTU' : 'LIVE';
logger.info('Starting batch update', { scmdbVersion, itemVersion, provider, channel, dryRun: options.dryRun });
console.log(`=== Starting update (${channel}, provider: ${provider}) ===`);
console.log(`  SCMDB:    ${scmdbVersion}`);
console.log(`  ${provider === 'datacore' ? 'DataCore' : 'SPViewer'}: ${itemVersion}\n`);

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

// Preflight: verify every declared static source file exists before touching anything.
try {
  await preflightCheckConfigs(categories);
} catch (err) {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('Preflight check failed', { error: error.message });
  console.error(`\nERROR: ${error.message}\n`);
  await shutdownLogger();
  process.exit(1);
}

const totalStart = performance.now();
logger.debug('Starting batch update', { categoryCount: categories.length, dryRun: options.dryRun });
console.log('=== Updating all item descriptions ===\n');

const iniPath = options.iniPath || path.join(repoRoot, 'global.ini');
let plannedArtifact: Artifact | null = null;

if (values['emit-artifact']) {
  try {
    plannedArtifact = await generateArtifact(categories, {
      iniPath,
      scmdbVersion,
      spviewerVersion: spviewerVersionDir ? itemVersion : undefined,
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Failed to generate patch artifact', { error: error.message });
    console.error(`ERROR generating artifact: ${error.message}`);
    await shutdownLogger();
    process.exit(1);
  }
}

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
    results.push(await enrichGlobalIni(config, { ...sharedOptions, csvDir: entryCsvDir }));
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
  if (!spviewerVersionDir) return null; // requires SPViewer data
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
  if (!spviewerVersionDir) return null; // requires SPViewer data
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
  if (!spviewerVersionDir) return null; // requires SPViewer data
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
  if (!plannedArtifact) {
    throw new Error('Patch artifact was not prepared before emission');
  }
  const artifact: Artifact = {
    ...plannedArtifact,
    stats: {
      ...plannedArtifact.stats,
      totalErrors: plannedArtifact.stats.totalErrors + errors.length,
    },
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
