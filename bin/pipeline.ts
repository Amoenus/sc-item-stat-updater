import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import cliProgress from 'cli-progress';
import { runFullPipeline } from '../src/application/use-cases/run-full-pipeline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

function log(msg: string): void {
  console.log(`[pipeline] ${msg}`);
}

const { values } = parseArgs({
  options: {
    scrape: { type: 'boolean', default: false },
    datacore: { type: 'boolean', default: false },
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
  --datacore    Run scrape:scmdb and scrape:datacore before updating (replaces --scrape)
  --dry-run     Preview changes without writing
  --ptu         Use PTU scraped data
  -v, --verbose Enable verbose logging
  -h, --help    Show this message`);
  process.exit(0);
}

const totalSteps = 3 + (values.scrape || values.datacore ? 2 : 0);
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

const result = await runFullPipeline({
  rootDir: ROOT_DIR,
  scrape: values.scrape,
  datacore: values.datacore,
  dryRun: values['dry-run'],
  ptu: values.ptu,
  verbose: values.verbose,
  log,
  onStepComplete: completeStep,
});

log('=== Done ===');
if (result.exitCode !== 0) process.exit(result.exitCode);
