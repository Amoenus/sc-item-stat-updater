const { parseArgs } = require('node:util');
const { runUpdate } = require('./src/lib/updater');
const cliProgress = require('cli-progress');

const { values } = parseArgs({
  options: {
    'ini-path': { type: 'string', short: 'i' },
    'csv-dir':  { type: 'string', short: 'c' },
    'dry-run':  { type: 'boolean', default: false },
    'help':     { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
});

if (values.help) {
  console.log('Usage: node update-all.js [options]');
  console.log('\nOptions:');
  console.log('  -i, --ini-path <path>  Path to global.ini (default: ./global.ini)');
  console.log('  -c, --csv-dir <path>   Directory containing CSV files (default: .)');
  console.log('      --dry-run          Preview changes without writing');
  console.log('  -h, --help             Show this help message');
  process.exit(0);
}

const options = {
  iniPath: values['ini-path'],
  csvDir: values['csv-dir'],
  dryRun: values['dry-run'],
};

const categories = [
  './src/items/quantum-drives',
  './src/items/coolers',
  './src/items/powerplants',
  './src/items/shields',
  './src/items/weapons',
  './src/items/bombs',
  './src/items/emps',
  './src/items/mining-lasers',
  './src/items/missiles',
  './src/items/qeds',
  './src/items/radars',
  './src/items/tractor-beams',
];

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
  const config = require(categories[i]);
  bar.update(i, { category: config.label });
  try {
    results.push(runUpdate(config, options));
  } catch (err) {
    errors.push({ label: config.label, message: err.message });
  }
}

bar.update(categories.length, { category: 'Done' });
bar.stop();

console.log();
for (const r of results) console.log(r.summary);
for (const e of errors) console.error(`ERROR in ${e.label}: ${e.message}`);
console.log('\n=== All updates complete ===');

if (errors.length > 0) process.exit(1);
