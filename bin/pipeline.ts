import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { extractGlobalIni } from './extract-global-ini.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

function log(msg: string): void {
  console.log(`[pipeline] ${msg}`);
}

function runScript(scriptArgs: string[]): void {
  const result = spawnSync('node', ['--import', 'tsx/esm', ...scriptArgs], {
    stdio: 'inherit',
    cwd: ROOT_DIR,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const { values } = parseArgs({
  options: {
    scrape: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    ptu: { type: 'boolean', default: false },
    verbose: { type: 'boolean', short: 'v', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
});

if (values.help) {
  console.log(`Usage: node --import tsx/esm bin/pipeline.ts [options]

Options:
  --scrape      Run scrape:scmdb and scrape:spviewer before updating
  --dry-run     Preview changes without writing
  --ptu         Use PTU scraped data
  -v, --verbose Enable verbose logging
  -h, --help    Show this message`);
  process.exit(0);
}

const updateArgs: string[] = ['bin/update-all.ts'];
if (values['dry-run']) updateArgs.push('--dry-run');
if (values.ptu) updateArgs.push('--ptu');
if (values.verbose) updateArgs.push('--verbose');

// Step 1: Extract
log('=== Step 1: Extracting global.ini ===');
await extractGlobalIni();

// Step 2: Scrape (optional)
if (values.scrape) {
  log('=== Step 2: Scraping SCMDB ===');
  runScript(['bin/scrape-scmdb.ts']);

  log('=== Step 2b: Scraping SPViewer ===');
  runScript(['bin/scrape-spviewer.ts', '--all']);
} else {
  log('=== Step 2: Skipping scrape (pass --scrape to enable) ===');
}

// Step 3: Apply updates
log('=== Step 3: Applying stat updates ===');
runScript(updateArgs);

log('=== Done ===');
