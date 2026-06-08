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
    'skip-unforge': { type: 'boolean', default: false },
    'force-extract': { type: 'boolean', default: false },
    verbose: { type: 'boolean', short: 'v', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
});

if (values.help) {
  console.log(`Usage: node --import tsx/esm bin/pipeline.ts [options]

Options:
  --scrape        Run scrape:scmdb and scrape:datacore before updating
  --datacore      Legacy alias for --scrape
  --dry-run       Preview changes without writing
  --ptu           Use PTU scraped data
  --skip-unforge  Skip the long-running unforge extraction step and reuse cached XMLs
  --force-extract Re-run unforge even if the XML cache already exists
  -v, --verbose   Enable verbose logging
  -h, --help      Show this message`);
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

let extractBar: cliProgress.SingleBar | undefined;

const result = await runFullPipeline({
  rootDir: ROOT_DIR,
  scrape: values.scrape,
  datacore: values.datacore,
  dryRun: values['dry-run'],
  ptu: values.ptu,
  skipUnforge: values['skip-unforge'],
  forceExtract: values['force-extract'],
  verbose: values.verbose,
  log,
  onStepComplete: completeStep,
  onCacheExtractStart: (dcbPath, xmlCacheDir, clearExisting) => {
    log('WARNING: The unforge step is intensive, long-running, and will take a while.');
    extractBar = new cliProgress.SingleBar({
      format: 'Unforge {bar} {value} XMLs extracted...',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });
    extractBar.start(0, 0); // Indeterminate or growing max
  },
  onCacheExtractProgress: (count) => {
    if (extractBar) {
      extractBar.setTotal(count); // just to keep the bar full or spinning
      extractBar.update(count);
    }
  },
  onCacheExtractComplete: (count) => {
    if (extractBar) {
      extractBar.setTotal(count);
      extractBar.update(count);
      extractBar.stop();
    }
  },
});

log('=== Done ===');
if (result.exitCode !== 0) process.exit(result.exitCode);
