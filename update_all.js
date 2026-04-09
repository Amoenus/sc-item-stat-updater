const { execSync } = require('child_process');
const path = require('path');

const scripts = [
  'update_quantum_drives.js',
  'update_coolers.js',
  'update_powerplants.js',
  'update_shields_csv.js',
  'update_weapons.js',
  'update_bombs.js',
  'update_emps.js',
  'update_mining_lasers.js',
  'update_missiles.js',
  'update_qeds.js',
  'update_radars.js',
  'update_tractor_beams.js',
];

const dir = String.raw`c:\Games\Roberts Space Industries\StarCitizen\LIVE\Data\Localization\english`;

console.log('=== Updating all item descriptions ===\n');

for (const script of scripts) {
  const fullPath = path.join(dir, script);
  console.log(`--- Running ${script} ---`);
  try {
    const output = execSync(`node "${fullPath}"`, { encoding: 'utf-8', cwd: dir });
    console.log(output);
  } catch (err) {
    console.error(`ERROR in ${script}: ${err.message}`);
    if (err.stdout) console.log(err.stdout);
    if (err.stderr) console.error(err.stderr);
  }
}

console.log('=== All updates complete ===');
