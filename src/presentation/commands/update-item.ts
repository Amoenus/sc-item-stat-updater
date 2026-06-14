import { parseArgs } from 'node:util';
import {
  buildCategoryListing,
  buildProviderCoverageMatrix,
  formatCategoryListing,
  formatProviderCoverageMatrix,
} from '../../application/catalog/category-listing';
import {
  buildDataCorePatchDriftDiagnostics,
  formatDataCorePatchDriftDiagnostics,
} from '../../application/diagnostics/datacore-patch-drift-diagnostics';
import {
  buildDataCoreRelationshipCoverageDiagnostics,
  formatDataCoreRelationshipCoverageDiagnostics,
} from '../../application/diagnostics/datacore-relationship-coverage-diagnostics';
import {
  buildDynamicCoverageAudit,
  formatDynamicCoverageAudit,
} from '../../application/diagnostics/dynamic-coverage-audit';
import {
  buildScmdbDependencyAudit,
  formatScmdbDependencyAudit,
} from '../../application/diagnostics/scmdb-dependency-audit';
import { enrichGlobalIni } from '../../application/use-cases/enrich-global-ini';
import { getLogger } from '../../infrastructure/logger';
import { listCategories, loadConfig } from '../../items/registry';
import {
  applyLogFlags,
  type CommandIO,
  defaultCommandIO,
  printIssuesTo,
  registerUnhandledRejectionHandler,
  writeErrorLine,
  writeLine,
} from '../cli';

const logger = getLogger('update-item');

export async function runUpdateItemCommand(argv: string[], io: CommandIO = defaultCommandIO()): Promise<number> {
  registerUnhandledRejectionHandler(logger);

  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      'ini-path': { type: 'string', short: 'i' },
      'csv-dir': { type: 'string', short: 'c' },
      'dry-run': { type: 'boolean', default: false },
      'list-categories': { type: 'boolean', default: false },
      'provider-matrix': { type: 'boolean', default: false },
      'scmdb-audit': { type: 'boolean', default: false },
      'dynamic-audit': { type: 'boolean', default: false },
      'patch-drift-audit': { type: 'boolean', default: false },
      'relationship-coverage-audit': { type: 'boolean', default: false },
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
    writeLine(io, formatCategoryListing(await buildCategoryListing()));
    return 0;
  }

  if (values['provider-matrix']) {
    writeLine(io, formatProviderCoverageMatrix(await buildProviderCoverageMatrix()));
    return 0;
  }

  if (values['scmdb-audit']) {
    writeLine(io, formatScmdbDependencyAudit(await buildScmdbDependencyAudit({ provider: 'datacore' })));
    return 0;
  }

  if (values['dynamic-audit']) {
    writeLine(io, formatDynamicCoverageAudit(await buildDynamicCoverageAudit()));
    return 0;
  }

  if (values['patch-drift-audit']) {
    writeLine(io, formatDataCorePatchDriftDiagnostics(await buildDataCorePatchDriftDiagnostics({ ptu: values.ptu })));
    return 0;
  }

  if (values['relationship-coverage-audit']) {
    writeLine(
      io,
      formatDataCoreRelationshipCoverageDiagnostics(
        await buildDataCoreRelationshipCoverageDiagnostics({
          ptu: values.ptu,
          iniPath: values['ini-path'],
        }),
      ),
    );
    return 0;
  }

  if (values.help || !category) {
    const available = await listCategories();
    const activeSlugs = [...available.datacore, ...available.missions];
    writeLine(io, 'Usage: node update-item.js [options] <category>');
    writeLine(io, '\nOptions:');
    writeLine(io, '  -i, --ini-path <path>  Path to global.ini (default: ./global.ini)');
    writeLine(io, '  -c, --csv-dir <path>   Directory containing CSV files (default: ./csv)');
    writeLine(io, '      --dry-run          Preview changes without writing');
    writeLine(io, '      --list-categories  List categories with provider and source file metadata');
    writeLine(io, '      --provider-matrix  List provider coverage by category');
    writeLine(io, '      --scmdb-audit      List remaining SCMDB dependencies and migration classifications');
    writeLine(io, '      --dynamic-audit    List dynamic coverage signals, source gaps, and static mapping risks');
    writeLine(io, '      --patch-drift-audit  Check DataCore CSV and record-graph drift after a patch');
    writeLine(io, '      --relationship-coverage-audit  Check graph vs fallback localization key coverage');
    writeLine(io, '      --ptu              Use latest PTU source directories for report commands');
    writeLine(io, '      --force            Force update even when values are unchanged');
    writeLine(io, '  -v, --verbose          Enable verbose logging');
    writeLine(io, '      --json-logs        Output logs as JSON (for log aggregation)');
    writeLine(io, '  -h, --help             Show this help message');
    writeLine(io, `\nAvailable active update categories:\n  ${activeSlugs.join('\n  ')}`);
    return values.help ? 0 : 1;
  }

  applyLogFlags(values);

  const options = {
    iniPath: values['ini-path'],
    csvDir: values['csv-dir'],
    dryRun: values['dry-run'],
    force: values.force,
  };

  try {
    const config = await loadConfig(category);
    const result = await enrichGlobalIni(config, options);
    writeLine(io, result.summary);
    printIssuesTo(io, result.issues, '\nProblem rows:');
    return 0;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error(`Failed to update ${category}`, {
      error: error.message,
      cause: err instanceof Error && 'cause' in err && err.cause instanceof Error ? err.cause.message : undefined,
    });
    writeErrorLine(io, `ERROR in ${category}: ${error.message}`);
    return 1;
  }
}
