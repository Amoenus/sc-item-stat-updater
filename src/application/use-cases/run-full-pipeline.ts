import path from 'node:path';
import { formatScmdbDependencyAudit } from '../diagnostics/scmdb-dependency-audit';
import { formatSourceFreshnessDiagnostics } from '../diagnostics/source-freshness-diagnostics';
import { deployGlobalIni } from './deploy-global-ini';
import { refreshGlobalIni } from './refresh-global-ini';
import { refreshSourceCache } from './refresh-source-cache';
import { runBatchUpdate } from './run-batch-update';
import type { DataCoreTypeEntry } from './run-datacore-scrape';

export interface RunFullPipelineOptions {
  rootDir: string;
  scrape?: boolean;
  datacore?: boolean;
  refreshSources?: boolean;
  deployUpdatedIni?: boolean;
  dryRun?: boolean;
  ptu?: boolean;
  skipUnforge?: boolean;
  force?: boolean;
  forceExtract?: boolean;
  verbose?: boolean;
  log?: (message: string) => void;
  onStepComplete?: (summary: string) => void;
  runUpdate?: typeof runBatchUpdate;
  refreshSourcesUseCase?: typeof refreshSourceCache;
  refresh?: typeof refreshGlobalIni;
  deploy?: typeof deployGlobalIni;
  onCacheHit?: (count: number, xmlCacheDir: string) => void;
  onCacheExtractStart?: (dcbPath: string, xmlCacheDir: string, clearExisting: boolean) => void;
  onCacheExtractProgress?: (count: number) => void;
  onCacheExtractComplete?: (count: number) => void;
  onDatacorePrepared?: (context: { selectedTypes: DataCoreTypeEntry[] }) => void;
  onRecordGraphStart?: (total: number) => void;
  onRecordGraphProgress?: (current: number, total: number) => void;
  onRecordGraphCacheHit?: (recordCount: number, outputPath: string) => void;
  onRawFactStart?: (slug: string, total: number) => void;
  onRawFactProgress?: (current: number) => void;
  onTypeStart?: (entry: DataCoreTypeEntry, index: number) => void;
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
  const refreshSourcesUseCase = options.refreshSourcesUseCase ?? refreshSourceCache;
  const refresh = options.refresh ?? refreshGlobalIni;
  const deploy = options.deploy ?? deployGlobalIni;
  const shouldRefreshSources = options.refreshSources ?? options.scrape ?? options.datacore ?? true;
  const shouldDeploy = options.deployUpdatedIni ?? true;

  log('=== Step 1: Extracting global.ini from Data.p4k ===');
  const { extractedGamePath } = await refresh({ repoIniPath, log });
  options.onStepComplete?.('global.ini extracted & synced to repo');

  if (shouldRefreshSources) {
    const cacheResult = await refreshSourcesUseCase({
      repoRoot: options.rootDir,
      target: options.datacore && !options.scrape ? 'datacore' : 'all',
      ptu: options.ptu,
      force: options.force ?? options.forceExtract,
      log,
      onCacheHit: options.onCacheHit,
      onCacheExtractStart: options.onCacheExtractStart,
      onCacheExtractProgress: options.onCacheExtractProgress,
      onCacheExtractComplete: options.onCacheExtractComplete,
      onDatacorePrepared: options.onDatacorePrepared,
      onRecordGraphStart: options.onRecordGraphStart,
      onRecordGraphProgress: options.onRecordGraphProgress,
      onRecordGraphCacheHit: options.onRecordGraphCacheHit,
      onRawFactStart: options.onRawFactStart,
      onRawFactProgress: options.onRawFactProgress,
      onTypeStart: options.onTypeStart,
    });
    if (cacheResult.exitCode !== 0) return { exitCode: cacheResult.exitCode, extractedGamePath, repoIniPath };
    for (const source of cacheResult.refreshed) {
      options.onStepComplete?.(`${source.toUpperCase()} cache refreshed`);
    }
  } else {
    log('=== Step 2: Using cached source outputs ===');
  }

  log('=== Step 3: Applying stat updates ===');
  const updateResult = await runUpdate({
    repoRoot: options.rootDir,
    dryRun: options.dryRun,
    ptu: options.ptu,
    provider: 'datacore',
    onCategoryError: (error) => log(`[ERROR] Category ${error.label} failed: ${error.message}`),
    onExtraStepError: (error) => log(`[ERROR] Extra step ${error.label} failed: ${error.message}`),
  });
  log(formatSourceFreshnessDiagnostics(updateResult.sourceDiagnostics));
  if (updateResult.scmdbDependencyAudit) {
    log(formatScmdbDependencyAudit(updateResult.scmdbDependencyAudit));
  }
  if (updateResult.exitCode !== 0) return { exitCode: updateResult.exitCode, extractedGamePath, repoIniPath };
  options.onStepComplete?.('Stat updates applied');

  if (shouldDeploy) {
    log('=== Step 4: Deploying updated global.ini -> game directory ===');
    await deploy({ repoIniPath, targetIniPath: extractedGamePath });
    log(`Deployed: ${extractedGamePath}`);
    options.onStepComplete?.('global.ini deployed to game directory');
  } else {
    log('=== Step 4: Skipping deploy (--repo-only) ===');
  }

  return { exitCode: 0, extractedGamePath, repoIniPath };
}
