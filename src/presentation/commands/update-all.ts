import path from 'node:path';
import { parseArgs } from 'node:util';
import { DATACORE_RAW_FACTS } from '../../application/catalog/category-listing';
import {
  buildMiningJournalRarityComparison,
  formatMiningJournalRarityComparison,
} from '../../application/diagnostics/mining-journal-rarity-comparison';
import {
  buildScmdbDependencyAudit,
  formatScmdbDependencyAudit,
} from '../../application/diagnostics/scmdb-dependency-audit';
import {
  buildSourceFreshnessDiagnostics,
  formatSourceFreshnessDiagnostics,
} from '../../application/diagnostics/source-freshness-diagnostics';
import { preflightCheckConfigs } from '../../application/update/update-planning';
import { prepareUpdateCategories, type UpdateProvider } from '../../application/use-cases/prepare-update-categories';
import {
  type BatchUpdateError,
  type BatchUpdateResult,
  runPreparedUpdateCategories,
} from '../../application/use-cases/run-prepared-update-categories';
import { getUpdateExtraStepLabels, runUpdateExtraSteps } from '../../application/use-cases/run-update-extra-steps';
import { type Artifact, generateArtifact, writeArtifactFile } from '../../artifact/artifact';
import { getLogger } from '../../infrastructure/logger';
import { backupIniFile } from '../../localization/ini-file';
import {
  applyLogFlags,
  type CommandIO,
  defaultCommandIO,
  registerUnhandledRejectionHandler,
  writeErrorLine,
  writeLine,
} from '../cli';
import { createCliEventRenderer } from '../events';

const logger = getLogger('update-all');

type StepError = { label: string; message: string };
type AnyUpdateResult = BatchUpdateResult;

function printSummary(io: CommandIO, results: AnyUpdateResult[], errors: StepError[], totalDuration: number): void {
  writeLine(io);
  for (const result of results) writeLine(io, result.summary);

  const allIssues = results.flatMap((result) =>
    ((result.issues ?? []) as Array<{ key: string; reason: string; type: string }>).map((issue) => ({
      label: result.label,
      ...issue,
    })),
  );
  if (allIssues.length > 0) {
    writeLine(io, '\nProblem rows:');
    for (const issue of allIssues) {
      const tag = issue.type ? `${issue.type.toUpperCase()} | ` : '';
      writeLine(io, `  ${issue.label} | ${tag}${issue.key} - ${issue.reason}`);
    }
  }

  for (const error of errors) writeErrorLine(io, `ERROR in ${error.label}: ${error.message}`);
  writeLine(io, `\n=== All updates complete [${totalDuration}ms] ===`);
}

function printHelp(io: CommandIO): void {
  writeLine(io, 'Usage: node update-all.js [options]');
  writeLine(io, '\nOptions:');
  writeLine(io, '  -i, --ini-path <path>  Path to global.ini (default: ./global.ini)');
  writeLine(
    io,
    '  -c, --csv-dir <path>   Directory containing CSV files (default: auto-detected from latest scraped version)',
  );
  writeLine(io, '      --dry-run          Preview changes without writing');
  writeLine(io, '      --emit-artifact <path>  Write a patch artifact JSON to the given path (ADR 002)');
  writeLine(io, '      --ptu              Use latest PTU scraped data instead of latest LIVE');
  writeLine(io, '      --include-mining-journal  Also update mining compendium journal entry');
  writeLine(io, '      --mining-journal-rarity-report  Print SCMDB vs DataCore mining journal rarity report and exit');
  writeLine(io, '      --provider datacore  Data provider (compatibility option; DataCore only)');
  writeLine(io, '  -v, --verbose          Enable verbose logging');
  writeLine(io, '      --json-logs        Output logs as JSON (for log aggregation)');
  writeLine(io, '  -h, --help             Show this help message');
}

export async function runUpdateAllCommand(argv: string[], io: CommandIO = defaultCommandIO()): Promise<number> {
  registerUnhandledRejectionHandler(logger);

  const { values } = parseArgs({
    args: argv,
    options: {
      'ini-path': { type: 'string', short: 'i' },
      'csv-dir': { type: 'string', short: 'c' },
      'dry-run': { type: 'boolean', default: false },
      'emit-artifact': { type: 'string' },
      ptu: { type: 'boolean', default: false },
      'include-mining-journal': { type: 'boolean', default: false },
      'mining-journal-rarity-report': { type: 'boolean', default: false },
      provider: { type: 'string', default: 'datacore' },
      verbose: { type: 'boolean', short: 'v', default: false },
      'json-logs': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });

  if (values.help) {
    printHelp(io);
    return 0;
  }

  applyLogFlags(values);

  const repoRoot = io.cwd;
  const providerValue = values.provider;
  if (providerValue !== 'datacore') {
    writeErrorLine(io, `Unknown --provider "${providerValue}". DataCore is the only active batch provider.`);
    return 1;
  }
  const provider: UpdateProvider = providerValue;

  const prepared = await prepareUpdateCategories({
    repoRoot,
    provider,
    ptu: values.ptu,
    csvDir: values['csv-dir'],
  });
  const { categories, scmdbVersion, itemVersion, itemVersionDir, missionCsvDir } = prepared;

  if (values['mining-journal-rarity-report']) {
    writeLine(
      io,
      `${formatMiningJournalRarityComparison(
        await buildMiningJournalRarityComparison({
          scmdbDir: missionCsvDir,
          datacoreDir: itemVersionDir,
        }),
      )}\n`,
    );
    return 0;
  }

  const options = {
    iniPath: values['ini-path'],
    csvDir: missionCsvDir,
    dryRun: values['dry-run'],
  };

  const channel = values.ptu ? 'PTU' : 'LIVE';
  logger.info('Starting batch update', { scmdbVersion, itemVersion, provider, channel, dryRun: options.dryRun });
  writeLine(io, `=== Starting update (${channel}, provider: ${provider}) ===`);

  const sourceDiagnostics = await buildSourceFreshnessDiagnostics(prepared, { provider, ptu: values.ptu });
  writeLine(io, `${formatSourceFreshnessDiagnostics(sourceDiagnostics)}\n`);
  writeLine(io, `${formatScmdbDependencyAudit(await buildScmdbDependencyAudit({ provider }))}\n`);

  try {
    await preflightCheckConfigs(categories, {
      rawFacts: DATACORE_RAW_FACTS.map((rawFact) => ({
        rawFact,
        baseDir: prepared.itemVersionDir,
        channel,
      })),
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Preflight check failed', { error: error.message });
    writeErrorLine(io, `\nERROR: ${error.message}\n`);
    return 1;
  }

  const totalStart = performance.now();
  logger.debug('Starting batch update', { categoryCount: categories.length, dryRun: options.dryRun });
  writeLine(io, '=== Updating all item descriptions ===\n');

  const iniPath = options.iniPath || path.join(repoRoot, 'global.ini');
  let plannedArtifact: Artifact | null = null;

  if (values['emit-artifact']) {
    try {
      plannedArtifact = await generateArtifact(categories, {
        iniPath,
        scmdbVersion,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to generate patch artifact', { error: error.message });
      writeErrorLine(io, `ERROR generating artifact: ${error.message}`);
      return 1;
    }
  }

  if (!options.dryRun) {
    await backupIniFile(iniPath);
    logger.debug('Created global.ini backup before batch update');
  }
  const sharedOptions = { ...options, skipBackup: true };

  const renderer = createCliEventRenderer(io);
  const extraStepLabels = getUpdateExtraStepLabels({ includeMiningJournal: values['include-mining-journal'] });
  const extraSteps = extraStepLabels.length;
  const results: AnyUpdateResult[] = [];
  const errors: StepError[] = [];

  renderer.emit({ type: 'progress:start', id: 'update-all', label: 'Update', total: categories.length + extraSteps });

  const categoryResult = await runPreparedUpdateCategories(categories, {
    ...sharedOptions,
    onCategoryStart: ({ config }, index) => {
      renderer.emit({ type: 'progress:update', id: 'update-all', value: index, label: config.label });
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
    datacoreVersionDir: itemVersionDir,
    dryRun: options.dryRun,
    includeMiningJournal: values['include-mining-journal'],
    onStepStart: (label, index) => {
      renderer.emit({ type: 'progress:update', id: 'update-all', value: categories.length + index, label });
      logger.info('Starting extra update step', { label });
    },
    onStepError: (error: BatchUpdateError) => {
      logger.error(`Failed: ${error.label}`, { error: error.message, cause: error.cause });
    },
  });

  results.push(...extraStepResult.results);
  errors.push(...extraStepResult.errors);

  renderer.emit({ type: 'progress:update', id: 'update-all', value: categories.length + extraSteps, label: 'Done' });
  renderer.emit({ type: 'progress:stop', id: 'update-all' });

  const totalDuration = Math.round(performance.now() - totalStart);

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
      writeLine(io, `\nOK Artifact written -> ${artifactPath} (${artifact.stats.totalEntries} entries)`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to write patch artifact', { error: error.message });
      writeErrorLine(io, `ERROR writing artifact: ${error.message}`);
    }
  }

  printSummary(io, results, errors, totalDuration);

  logger.debug('Batch update complete', {
    totalDuration,
    successCount: results.length,
    errorCount: errors.length,
  });

  return errors.length > 0 ? 1 : 0;
}
