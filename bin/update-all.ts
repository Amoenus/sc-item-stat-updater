import path from 'node:path';
import { parseArgs } from 'node:util';
import cliProgress from 'cli-progress';
import { type Artifact, generateArtifact, writeArtifactFile } from '../src/artifact/artifact';
import { prepareUpdateCategories, type UpdateProvider } from '../src/application/use-cases/prepare-update-categories';
import {
  type BatchUpdateError,
  type BatchUpdateResult,
  runPreparedUpdateCategories,
} from '../src/application/use-cases/run-prepared-update-categories';
import { getUpdateExtraStepLabels, runUpdateExtraSteps } from '../src/application/use-cases/run-update-extra-steps';
import { backupIniFile } from '../src/localization/ini-file';
import { applyLogFlags, registerUnhandledRejectionHandler } from '../src/presentation/cli';
import { getLogger, shutdownLogger } from '../src/infrastructure/logger';
import { preflightCheckConfigs } from '../src/application/use-cases/update-planning';
import { regenMiningLocations } from '../src/sources/scmdb/mining-locations';
import {
  buildSourceFreshnessDiagnostics,
  formatSourceFreshnessDiagnostics,
} from '../src/application/use-cases/source-freshness-diagnostics';
import { DATACORE_RAW_FACTS } from '../src/application/use-cases/category-listing';
import {
  buildScmdbDependencyAudit,
  formatScmdbDependencyAudit,
} from '../src/application/use-cases/scmdb-dependency-audit';
import {
  buildMiningJournalRarityComparison,
  formatMiningJournalRarityComparison,
} from '../src/application/use-cases/mining-journal-rarity-comparison';

const logger = getLogger('update-all');

registerUnhandledRejectionHandler(logger);

type StepError = { label: string; message: string };
type AnyUpdateResult = BatchUpdateResult;

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
    'mining-journal-rarity-report': { type: 'boolean', default: false },
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
  console.log('      --mining-journal-rarity-report  Print SCMDB vs DataCore mining journal rarity report and exit');
  console.log('      --provider <name>  Data provider: "spviewer" (default) or "datacore"');
  console.log('  -v, --verbose          Enable verbose logging');
  console.log('      --json-logs        Output logs as JSON (for log aggregation)');
  console.log('  -h, --help             Show this help message');
  process.exit(0);
}

applyLogFlags(values);

const repoRoot = path.resolve(import.meta.dirname, '..');

const providerValue =
  values['mining-journal-rarity-report'] && values.provider === 'spviewer' ? 'datacore' : values.provider;
if (providerValue !== 'spviewer' && providerValue !== 'datacore') {
  console.error(`Unknown --provider "${providerValue}". Valid values: spviewer, datacore`);
  process.exit(1);
}
const provider: UpdateProvider = providerValue;

const prepared = await prepareUpdateCategories({
  repoRoot,
  provider,
  ptu: values.ptu,
  csvDir: values['csv-dir'],
});
const { categories, scmdbVersion, itemVersion, itemVersionDir, missionCsvDir, spviewerVersionDir } = prepared;

if (values['mining-journal-rarity-report']) {
  console.log(
    `${formatMiningJournalRarityComparison(
      await buildMiningJournalRarityComparison({
        scmdbDir: missionCsvDir,
        datacoreDir: itemVersionDir,
      }),
    )}\n`,
  );
  await shutdownLogger();
  process.exit(0);
}

const options = {
  iniPath: values['ini-path'],
  csvDir: missionCsvDir,
  dryRun: values['dry-run'],
};

const channel = values.ptu ? 'PTU' : 'LIVE';
logger.info('Starting batch update', { scmdbVersion, itemVersion, provider, channel, dryRun: options.dryRun });
console.log(`=== Starting update (${channel}, provider: ${provider}) ===`);

const sourceDiagnostics = await buildSourceFreshnessDiagnostics(prepared, { provider, ptu: values.ptu });
console.log(`${formatSourceFreshnessDiagnostics(sourceDiagnostics)}\n`);
if (provider === 'datacore') {
  console.log(`${formatScmdbDependencyAudit(await buildScmdbDependencyAudit({ provider }))}\n`);
}

try {
  logger.info('Regenerating mining-locations.csv', { missionCsvDir });
  regenMiningLocations({
    repoRoot,
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
  await preflightCheckConfigs(categories, {
    rawFacts:
      provider === 'datacore'
        ? DATACORE_RAW_FACTS.map((rawFact) => ({
            rawFact,
            baseDir: prepared.itemVersionDir,
            channel,
          }))
        : undefined,
  });
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

const extraStepLabels = getUpdateExtraStepLabels({ includeMiningJournal: values['include-mining-journal'] });
const extraSteps = extraStepLabels.length;
const bar = new cliProgress.SingleBar({
  format: '{bar} {percentage}% | {value}/{total} | {category}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true,
});

const results: AnyUpdateResult[] = [];
const errors: StepError[] = [];

bar.start(categories.length + extraSteps, 0, { category: '' });

const categoryResult = await runPreparedUpdateCategories(categories, {
  ...sharedOptions,
  onCategoryStart: ({ config }, index) => {
    bar.update(index, { category: config.label });
  },
  onCategoryError: (error: BatchUpdateError) => {
    logger.error('Failed to update category', {
      label: error.label,
      error: error.message,
      cause: error.cause,
    });
  },
});

results.push(...categoryResult.results);
errors.push(...categoryResult.errors);

const extraStepResult = await runUpdateExtraSteps({
  iniPath,
  repoRoot,
  missionCsvDir,
  spviewerVersionDir,
  datacoreVersionDir: provider === 'datacore' ? itemVersionDir : undefined,
  dryRun: options.dryRun,
  includeMiningJournal: values['include-mining-journal'],
  onStepStart: (label, index) => {
    bar.update(categories.length + index, { category: label });
    logger.info('Starting extra update step', { label });
  },
  onStepError: (error: BatchUpdateError) => {
    logger.error(`Failed: ${error.label}`, { error: error.message, cause: error.cause });
  },
});

results.push(...extraStepResult.results);
errors.push(...extraStepResult.errors);

const barStep = categories.length + extraSteps;
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
