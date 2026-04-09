const path = require('path');
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

const category = process.argv[2];

if (!category || !ITEMS[category]) {
  console.log('Usage: node update-item.js <category>');
  console.log(`\nAvailable categories:\n  ${Object.keys(ITEMS).join('\n  ')}`);
  process.exit(1);
}

const config = require(ITEMS[category]);
const result = runUpdate(config);
console.log(result.summary);
