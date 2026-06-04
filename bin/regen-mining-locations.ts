/**
 * Regenerates mining-locations.csv from the locally cached mining_data.json,
 * without fetching anything from the network.
 *
 * Usage: node bin/regen-mining-locations.js [--scmdb-dir <path>]
 *
 * Reads:  <scmdb-dir>/mining_data.json or csv/scmdb/<latest-version>/mining_data.json
 * Writes: <scmdb-dir>/mining-locations.csv
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { regenMiningLocations } from '../src/sources/scmdb/mining-locations';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function defaultLogger(message: string): void {
  console.log(message);
}

export function runCli() {
  const { values } = parseArgs({
    options: {
      'scmdb-dir': { type: 'string', short: 'c' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });

  if (values.help) {
    console.log('Usage: node bin/regen-mining-locations.js [--scmdb-dir <path>]');
    console.log('  --scmdb-dir, -c   Explicit SCMDB version directory to process');
    return;
  }

  regenMiningLocations({ repoRoot, scmdbDir: values['scmdb-dir'], log: defaultLogger });
}

const isEntrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href === import.meta.url : false;

if (isEntrypoint) {
  runCli();
}
