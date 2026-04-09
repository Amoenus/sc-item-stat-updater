const { runUpdate } = require('./src/lib/updater');

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

for (const cat of categories) {
  const config = require(cat);
  try {
    runUpdate(config);
  } catch (err) {
    console.error(`ERROR in ${config.label}: ${err.message}`);
  }
}

console.log('\n=== All updates complete ===');
