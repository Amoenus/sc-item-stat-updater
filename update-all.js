import { parseArgs } from 'node:util';
import { runUpdate } from './src/lib/updater.js';
import { getLogger, setLogLevel, setJsonOutput, shutdownLogger } from './src/lib/logger.js';
import cliProgress from 'cli-progress';

import quantumDrivesConfig from './src/items/quantum-drives.js';
import coolersConfig from './src/items/coolers.js';
import powerplantsConfig from './src/items/powerplants.js';
import shieldsConfig from './src/items/shields.js';
import weaponsConfig from './src/items/weapons.js';
import bombsConfig from './src/items/bombs.js';
import empsConfig from './src/items/emps.js';
import miningLasersConfig from './src/items/mining-lasers.js';
import missilesConfig from './src/items/missiles.js';
import qedsConfig from './src/items/qeds.js';
import radarsConfig from './src/items/radars.js';
import tractorBeamsConfig from './src/items/tractor-beams.js';

const logger = getLogger('update-all');

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { error: String(reason) });
  process.exit(1);
});

const { values } = parseArgs({
  options: {
    'ini-path': { type: 'string', short: 'i' },
    'csv-dir':  { type: 'string', short: 'c' },
    'dry-run':   { type: 'boolean', default: false },
    'verbose':   { type: 'boolean', short: 'v', default: false },
    'json-logs': { type: 'boolean', default: false },
    'help':      { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
});

if (values.help) {
  console.log('Usage: node update-all.js [options]');
  console.log('\nOptions:');
  console.log('  -i, --ini-path <path>  Path to global.ini (default: ./global.ini)');
  console.log('  -c, --csv-dir <path>   Directory containing CSV files (default: .)');
  console.log('      --dry-run          Preview changes without writing');
  console.log('  -v, --verbose          Enable verbose logging');
  console.log('      --json-logs        Output logs as JSON (for log aggregation)');
  console.log('  -h, --help             Show this help message');
  process.exit(0);
}

if (values.verbose) setLogLevel('debug');
if (values['json-logs']) setJsonOutput(true);

const options = {
  iniPath: values['ini-path'],
  csvDir: values['csv-dir'],
  dryRun: values['dry-run'],
};

const categories = [
  quantumDrivesConfig,
  coolersConfig,
  powerplantsConfig,
  shieldsConfig,
  weaponsConfig,
  bombsConfig,
  empsConfig,
  miningLasersConfig,
  missilesConfig,
  qedsConfig,
  radarsConfig,
  tractorBeamsConfig,
];

const totalStart = performance.now();
logger.debug('Starting batch update', { categoryCount: categories.length, dryRun: options.dryRun });
console.log('=== Updating all item descriptions ===\n');

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
  const config = categories[i];
  bar.update(i, { category: config.label });
  try {
    results.push(await runUpdate(config, options));
  } catch (err) {
    errors.push({ label: config.label, message: err.message });
    logger.error('Failed to update category', {
      label: config.label, error: err.message, cause: err.cause?.message,
    });
  }
}

bar.update(categories.length, { category: 'Done' });
bar.stop();

const totalDuration = Math.round(performance.now() - totalStart);

console.log();
for (const r of results) console.log(r.summary);

const allIssues = results.flatMap(r => r.issues.map(i => ({ label: r.label, ...i })));
if (allIssues.length > 0) {
  console.log('\n⚠ Problem rows:');
  for (const issue of allIssues) {
    console.log(`  ${issue.label} | ${issue.key} — ${issue.reason}`);
  }
}

for (const e of errors) console.error(`ERROR in ${e.label}: ${e.message}`);
console.log(`\n=== All updates complete [${totalDuration}ms] ===`);

logger.debug('Batch update complete', {
  totalDuration, successCount: results.length, errorCount: errors.length,
});

await shutdownLogger();

if (errors.length > 0) process.exit(1);
