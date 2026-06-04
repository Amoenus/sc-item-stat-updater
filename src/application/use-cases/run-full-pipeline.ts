import path from 'node:path';
import { deployGlobalIni } from './deploy-global-ini';
import { refreshGlobalIni } from './refresh-global-ini';
import { runBatchUpdate } from './run-batch-update';
import { runDatacoreScrape } from './run-datacore-scrape';
import { runScmdbScrape } from './run-scmdb-scrape';
import { runSpviewerScrape } from './run-spviewer-scrape';
import { formatSourceFreshnessDiagnostics } from './source-freshness-diagnostics';

export interface RunFullPipelineOptions {
  rootDir: string;
  scrape?: boolean;
  datacore?: boolean;
  dryRun?: boolean;
  ptu?: boolean;
  verbose?: boolean;
  log?: (message: string) => void;
  onStepComplete?: (summary: string) => void;
  runUpdate?: typeof runBatchUpdate;
  runDatacore?: typeof runDatacoreScrape;
  runScmdb?: typeof runScmdbScrape;
  runSpviewer?: typeof runSpviewerScrape;
  refresh?: typeof refreshGlobalIni;
  deploy?: typeof deployGlobalIni;
}

export interface RunFullPipelineResult {
  exitCode: number;
  extractedGamePath?: string;
  repoIniPath: string;
}

export async function runFullPipeline(options: RunFullPipelineOptions): Promise<RunFullPipelineResult> {
  const log = options.log ?? (() => {});
  const repoIniPath = path.join(options.rootDir, 'global.ini');

  const runUpdate = options.runUpdate ?? runBatchUpdate;
  const runDatacore = options.runDatacore ?? runDatacoreScrape;
  const runScmdb = options.runScmdb ?? runScmdbScrape;
  const runSpviewer = options.runSpviewer ?? runSpviewerScrape;
  const refresh = options.refresh ?? refreshGlobalIni;
  const deploy = options.deploy ?? deployGlobalIni;

  log('=== Step 1: Extracting global.ini from Data.p4k ===');
  const { extractedGamePath } = await refresh({ repoIniPath, log });
  options.onStepComplete?.('global.ini extracted & synced to repo');

  if (options.datacore) {
    log('=== Step 2: Scraping SCMDB ===');
    await runScmdb({ repoRoot: options.rootDir, ptu: options.ptu });
    options.onStepComplete?.('SCMDB scraped');

    log('=== Step 2b: Scraping Datacore ===');
    const datacoreResult = await runDatacore({
      repoRoot: options.rootDir,
      ptu: options.ptu,
    });
    if (datacoreResult.exitCode !== 0) return { exitCode: datacoreResult.exitCode, extractedGamePath, repoIniPath };
    options.onStepComplete?.('Datacore scraped');
  } else if (options.scrape) {
    log('=== Step 2: Scraping SCMDB ===');
    await runScmdb({ repoRoot: options.rootDir, ptu: options.ptu });
    options.onStepComplete?.('SCMDB scraped');

    log('=== Step 2b: Scraping SPViewer ===');
    const spviewerResult = await runSpviewer({
      repoRoot: options.rootDir,
      ptu: options.ptu,
    });
    if (spviewerResult.exitCode !== 0) return { exitCode: spviewerResult.exitCode, extractedGamePath, repoIniPath };
    options.onStepComplete?.('SPViewer scraped');
  } else {
    log('=== Step 2: Skipping scrape (pass --scrape or --datacore to enable) ===');
  }

  log('=== Step 3: Applying stat updates ===');
  const updateResult = await runUpdate({
    repoRoot: options.rootDir,
    dryRun: options.dryRun,
    ptu: options.ptu,
    provider: options.datacore ? 'datacore' : 'spviewer',
  });
  log(formatSourceFreshnessDiagnostics(updateResult.sourceDiagnostics));
  if (updateResult.exitCode !== 0) return { exitCode: updateResult.exitCode, extractedGamePath, repoIniPath };
  options.onStepComplete?.('Stat updates applied');

  log('=== Step 4: Deploying updated global.ini -> game directory ===');
  await deploy({ repoIniPath, targetIniPath: extractedGamePath });
  log(`Deployed: ${extractedGamePath}`);
  options.onStepComplete?.('global.ini deployed to game directory');

  return { exitCode: 0, extractedGamePath, repoIniPath };
}
