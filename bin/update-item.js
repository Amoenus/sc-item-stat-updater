import { parseArgs } from 'node:util';
import { listCategories, loadConfig } from '../src/items/registry.js';
import { getLogger, setJsonOutput, setLogLevel, shutdownLogger } from '../src/lib/logger.js';
import { runUpdate } from '../src/lib/updater.js';

const logger = getLogger('update-item');

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { error: String(reason) });
  process.exit(1);
});

const { values, positionals } = parseArgs({
  options: {
    'ini-path': { type: 'string', short: 'i' },
    'csv-dir': { type: 'string', short: 'c' },
    'dry-run': { type: 'boolean', default: false },
    verbose: { type: 'boolean', short: 'v', default: false },
    'json-logs': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: true,
  strict: true,
});

const category = positionals[0];

if (values.help || !category) {
  const available = await listCategories();
  const allSlugs = [...available.erkul, ...available.spviewer];
  console.log('Usage: node update-item.js [options] <category>');
  console.log('\nOptions:');
  console.log('  -i, --ini-path <path>  Path to global.ini (default: ./global.ini)');
  console.log('  -c, --csv-dir <path>   Directory containing CSV files (default: ./csv)');
  console.log('      --dry-run          Preview changes without writing');
  console.log('  -v, --verbose          Enable verbose logging');
  console.log('      --json-logs        Output logs as JSON (for log aggregation)');
  console.log('  -h, --help             Show this help message');
  console.log(`\nAvailable categories:\n  ${allSlugs.join('\n  ')}`);
  process.exit(values.help ? 0 : 1);
}

if (values.verbose) setLogLevel('debug');
if (values['json-logs']) setJsonOutput(true);

const options = {
  iniPath: values['ini-path'],
  csvDir: values['csv-dir'],
  dryRun: values['dry-run'],
};

try {
  const config = await loadConfig(category);
  const result = await runUpdate(config, options);
  console.log(result.summary);
  if (result.issues.length > 0) {
    console.log('\n⚠ Problem rows:');
    for (const issue of result.issues) {
      const tag = issue.type ? `${issue.type.toUpperCase()} | ` : '';
      console.log(`  ${tag}${issue.key} — ${issue.reason}`);
    }
  }
} catch (err) {
  logger.error(`Failed to update ${category}`, { error: err.message, cause: err.cause?.message });
  console.error(`ERROR in ${category}: ${err.message}`);
  await shutdownLogger();
  process.exit(1);
}

await shutdownLogger();
