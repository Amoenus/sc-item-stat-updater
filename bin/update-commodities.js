import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { getLogger, setJsonOutput, setLogLevel, shutdownLogger } from '../src/lib/logger.js';
import { runCommodityUpdate } from '../src/lib/commodity-updater.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = getLogger('update-commodities');

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { error: String(reason) });
  process.exit(1);
});

const { values } = parseArgs({
  options: {
    'ini-path': { type: 'string', short: 'i' },
    'dry-run': { type: 'boolean', default: false },
    'verbose': { type: 'boolean', short: 'v', default: false },
    'json-logs': { type: 'boolean', default: false },
    'help': { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
});

if (values.help) {
  console.log('Usage: node update-commodities.js [options]');
  console.log('\nOptions:');
  console.log('  -i, --ini-path <path>  Path to global.ini (default: ./global.ini)');
  console.log('      --dry-run          Preview changes without writing');
  console.log('  -v, --verbose          Enable verbose logging');
  console.log('      --json-logs        Output logs as JSON');
  console.log('  -h, --help             Show this help message');
  process.exit(0);
}

if (values.verbose) setLogLevel('debug');
if (values['json-logs']) setJsonOutput(true);

const iniPath = path.resolve(__dirname, '..', values['ini-path'] ?? 'global.ini');

try {
  const result = await runCommodityUpdate({
    iniPath,
    dryRun: values['dry-run'],
    skipBackup: false,
  });

  if (result.updatedCount === 0) {
    console.log('No commodity display names required updating.');
    await shutdownLogger();
    process.exit(0);
  }

  console.log(`Commodity display updates: ${result.updatedCount}`);
  for (const update of result.updates) {
    console.log(`  ${update.key}: ${update.from} -> ${update.to}`);
  }

  if (values['dry-run']) {
    console.log('Dry run only; no file changes were written.');
  } else {
    console.log('global.ini updated successfully.');
  }

  await shutdownLogger();
} catch (err) {
  logger.error('Failed to update commodities', { error: err.message, cause: err.cause?.message });
  console.error(`ERROR: ${err.message}`);
  await shutdownLogger();
  process.exit(1);
}
