import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import cliProgress from 'cli-progress';
import { extractGlobalIni } from './extract-global-ini';

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

// Subprocesses use stdio:'inherit', so a persistent bar would conflict with their output.
// Instead, render a snapshot bar after each step completes (start → stop immediately).
const totalSteps = 2 + (values.scrape ? 2 : 0);
let completedSteps = 0;
const pipelineBar = new cliProgress.SingleBar({
  format: 'Pipeline {bar} {percentage}% | {value}/{total} | {step}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true,
  stopOnComplete: false,
});

function completeStep(summary: string): void {
  completedSteps++;
  pipelineBar.start(totalSteps, completedSteps, { step: summary });
  pipelineBar.stop();
}

// Step 1: Extract
log('=== Step 1: Extracting global.ini ===');
await extractGlobalIni();
completeStep('global.ini extracted');

// Step 2: Scrape (optional)
if (values.scrape) {
  log('=== Step 2: Scraping SCMDB ===');
  runScript(['bin/scrape-scmdb.ts']);
  completeStep('SCMDB scraped');

  log('=== Step 2b: Scraping SPViewer ===');
  runScript(['bin/scrape-spviewer.ts', '--all']);
  completeStep('SPViewer scraped');
} else {
  log('=== Step 2: Skipping scrape (pass --scrape to enable) ===');
}

// Step 3: Apply updates
log('=== Step 3: Applying stat updates ===');
runScript(updateArgs);
completeStep('Stat updates applied');

log('=== Done ===');
