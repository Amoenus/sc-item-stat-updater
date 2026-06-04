import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { deployGlobalIni } from './deploy-global-ini';
import { refreshGlobalIni } from './refresh-global-ini';

export interface RunFullPipelineOptions {
  rootDir: string;
  scrape?: boolean;
  datacore?: boolean;
  dryRun?: boolean;
  ptu?: boolean;
  verbose?: boolean;
  log?: (message: string) => void;
  onStepComplete?: (summary: string) => void;
  runScript?: (scriptArgs: string[]) => number;
}

export interface RunFullPipelineResult {
  exitCode: number;
  extractedGamePath?: string;
  repoIniPath: string;
}

function defaultRunScript(rootDir: string, scriptArgs: string[]): number {
  const result = spawnSync('node', ['--import', 'tsx/esm', ...scriptArgs], {
    stdio: 'inherit',
    cwd: rootDir,
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

export async function runFullPipeline(options: RunFullPipelineOptions): Promise<RunFullPipelineResult> {
  const log = options.log ?? (() => {});
  const runScript = options.runScript ?? ((scriptArgs) => defaultRunScript(options.rootDir, scriptArgs));
  const repoIniPath = path.join(options.rootDir, 'global.ini');

  const updateArgs: string[] = ['bin/update-all.ts'];
  if (options.dryRun) updateArgs.push('--dry-run');
  if (options.ptu) updateArgs.push('--ptu');
  if (options.verbose) updateArgs.push('--verbose');
  if (options.datacore) updateArgs.push('--provider', 'datacore');

  log('=== Step 1: Extracting global.ini from Data.p4k ===');
  const { extractedGamePath } = await refreshGlobalIni({ repoIniPath, log });
  options.onStepComplete?.('global.ini extracted & synced to repo');

  if (options.datacore) {
    log('=== Step 2: Scraping SCMDB ===');
    let exitCode = runScript(['bin/scrape-scmdb.ts']);
    if (exitCode !== 0) return { exitCode, extractedGamePath, repoIniPath };
    options.onStepComplete?.('SCMDB scraped');

    log('=== Step 2b: Scraping Datacore ===');
    exitCode = runScript(['bin/scrape-datacore.ts', '--all']);
    if (exitCode !== 0) return { exitCode, extractedGamePath, repoIniPath };
    options.onStepComplete?.('Datacore scraped');
  } else if (options.scrape) {
    log('=== Step 2: Scraping SCMDB ===');
    let exitCode = runScript(['bin/scrape-scmdb.ts']);
    if (exitCode !== 0) return { exitCode, extractedGamePath, repoIniPath };
    options.onStepComplete?.('SCMDB scraped');

    log('=== Step 2b: Scraping SPViewer ===');
    exitCode = runScript(['bin/scrape-spviewer.ts', '--all']);
    if (exitCode !== 0) return { exitCode, extractedGamePath, repoIniPath };
    options.onStepComplete?.('SPViewer scraped');
  } else {
    log('=== Step 2: Skipping scrape (pass --scrape or --datacore to enable) ===');
  }

  log('=== Step 3: Applying stat updates ===');
  const updateExitCode = runScript(updateArgs);
  if (updateExitCode !== 0) return { exitCode: updateExitCode, extractedGamePath, repoIniPath };
  options.onStepComplete?.('Stat updates applied');

  log('=== Step 4: Deploying updated global.ini -> game directory ===');
  await deployGlobalIni({ repoIniPath, targetIniPath: extractedGamePath });
  log(`Deployed: ${extractedGamePath}`);
  options.onStepComplete?.('global.ini deployed to game directory');

  return { exitCode: 0, extractedGamePath, repoIniPath };
}
