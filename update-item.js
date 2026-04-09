const { parseArgs } = require('node:util');
const { runUpdate } = require('./src/lib/updater');

const ITEMS = {
  'coolers':        './src/items/coolers',
  'weapons':        './src/items/weapons',
  'shields':        './src/items/shields',
  'quantum-drives': './src/items/quantum-drives',
  'powerplants':    './src/items/powerplants',
  'missiles':       './src/items/missiles',
  'bombs':          './src/items/bombs',
  'emps':           './src/items/emps',
  'mining-lasers':  './src/items/mining-lasers',
  'qeds':           './src/items/qeds',
  'radars':         './src/items/radars',
  'tractor-beams':  './src/items/tractor-beams',
};

const { values, positionals } = parseArgs({
  options: {
    'ini-path': { type: 'string', short: 'i' },
    'csv-dir':  { type: 'string', short: 'c' },
    'dry-run':  { type: 'boolean', default: false },
    'help':     { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: true,
  strict: true,
});

const category = positionals[0];

if (values.help || !category || !ITEMS[category]) {
  console.log('Usage: node update-item.js [options] <category>');
  console.log('\nOptions:');
  console.log('  -i, --ini-path <path>  Path to global.ini (default: ./global.ini)');
  console.log('  -c, --csv-dir <path>   Directory containing CSV files (default: .)');
  console.log('      --dry-run          Preview changes without writing');
  console.log('  -h, --help             Show this help message');
  console.log(`\nAvailable categories:\n  ${Object.keys(ITEMS).join('\n  ')}`);
  process.exit(values.help ? 0 : 1);
}

const options = {
  iniPath: values['ini-path'],
  csvDir: values['csv-dir'],
  dryRun: values['dry-run'],
};

try {
  const config = require(ITEMS[category]);
  const result = runUpdate(config, options);
  console.log(result.summary);
} catch (err) {
  console.error(`ERROR in ${category}: ${err.message}`);
  process.exit(1);
}
