import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  buildCategoryListing,
  buildProviderCoverageMatrix,
  formatCategoryListing,
  formatProviderCoverageMatrix,
} from '../src/application/use-cases/category-listing';
import { enrichGlobalIni } from '../src/application/use-cases/enrich-global-ini';
import {
  buildScmdbDependencyAudit,
  formatScmdbDependencyAudit,
} from '../src/application/use-cases/scmdb-dependency-audit';
import {
  buildSpviewerRetirementAudit,
  formatSpviewerRetirementAudit,
} from '../src/application/use-cases/spviewer-retirement-audit';
import { getLogger, shutdownLogger } from '../src/infrastructure/logger';
import { listCategories, loadConfig } from '../src/items/registry';
import { applyLogFlags, printIssues, registerUnhandledRejectionHandler } from '../src/presentation/cli';

const logger = getLogger('update-item');

registerUnhandledRejectionHandler(logger);

const { values, positionals } = parseArgs({
  options: {
    'ini-path': { type: 'string', short: 'i' },
    'csv-dir': { type: 'string', short: 'c' },
    'dry-run': { type: 'boolean', default: false },
    'list-categories': { type: 'boolean', default: false },
    'provider-matrix': { type: 'boolean', default: false },
    'scmdb-audit': { type: 'boolean', default: false },
    'spviewer-retirement-audit': { type: 'boolean', default: false },
    'datacore-dir': { type: 'string' },
    'spviewer-dir': { type: 'string' },
    ptu: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    verbose: { type: 'boolean', short: 'v', default: false },
    'json-logs': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: true,
  strict: true,
});

const category = positionals[0];

if (values['list-categories']) {
  console.log(formatCategoryListing(await buildCategoryListing()));
  await shutdownLogger();
  process.exit(0);
}

if (values['provider-matrix']) {
  console.log(formatProviderCoverageMatrix(await buildProviderCoverageMatrix()));
  await shutdownLogger();
  process.exit(0);
}

if (values['scmdb-audit']) {
  console.log(formatScmdbDependencyAudit(await buildScmdbDependencyAudit({ provider: 'datacore' })));
  await shutdownLogger();
  process.exit(0);
}

if (values['spviewer-retirement-audit']) {
  const repoRoot = path.resolve(import.meta.dirname, '..');
  console.log(
    formatSpviewerRetirementAudit(
      await buildSpviewerRetirementAudit({
        repoRoot,
        iniPath: values['ini-path'],
        datacoreDir: values['datacore-dir'],
        spviewerDir: values['spviewer-dir'],
        ptu: values.ptu,
      }),
    ),
  );
  await shutdownLogger();
  process.exit(0);
}

if (values.help || !category) {
  const available = await listCategories();
  const activeSlugs = [...available.datacore, ...available.missions];
  console.log('Usage: node update-item.js [options] <category>');
  console.log('\nOptions:');
  console.log('  -i, --ini-path <path>  Path to global.ini (default: ./global.ini)');
  console.log('  -c, --csv-dir <path>   Directory containing CSV files (default: ./csv)');
  console.log('      --dry-run          Preview changes without writing');
  console.log('      --list-categories  List categories with provider and source file metadata');
  console.log('      --provider-matrix  List provider coverage by category');
  console.log('      --scmdb-audit      List remaining SCMDB dependencies and migration classifications');
  console.log('      --spviewer-retirement-audit  Compare all paired SPViewer/DataCore item outputs');
  console.log('      --datacore-dir <path>  DataCore CSV directory for --spviewer-retirement-audit');
  console.log('      --spviewer-dir <path>  SPViewer CSV directory for --spviewer-retirement-audit');
  console.log('      --ptu              Use latest PTU source directories for report commands');
  console.log('      --force            Force update even when values are unchanged');
  console.log('  -v, --verbose          Enable verbose logging');
  console.log('      --json-logs        Output logs as JSON (for log aggregation)');
  console.log('  -h, --help             Show this help message');
  console.log(`\nAvailable active update categories:\n  ${activeSlugs.join('\n  ')}`);
  console.log('\nSPViewer categories are legacy comparison only; use --list-categories or --spviewer-retirement-audit.');
  process.exit(values.help ? 0 : 1);
}

applyLogFlags(values);

if (category.startsWith('sp-')) {
  console.error(
    `ERROR in ${category}: SPViewer categories are legacy comparison/audit only and cannot be used for active updates.`,
  );
  console.error('Use the matching dc-* category for game-file facts, or run --spviewer-retirement-audit for diagnostics.');
  await shutdownLogger();
  process.exit(1);
}

const options = {
  iniPath: values['ini-path'],
  csvDir: values['csv-dir'],
  dryRun: values['dry-run'],
  force: values.force,
};

try {
  const config = await loadConfig(category);
  const result = await enrichGlobalIni(config, options);
  console.log(result.summary);
  printIssues(result.issues, '\n⚠ Problem rows:');
} catch (err) {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error(`Failed to update ${category}`, {
    error: error.message,
    cause: err instanceof Error && 'cause' in err && err.cause instanceof Error ? err.cause.message : undefined,
  });
  console.error(`ERROR in ${category}: ${error.message}`);
  await shutdownLogger();
  process.exit(1);
}

await shutdownLogger();
