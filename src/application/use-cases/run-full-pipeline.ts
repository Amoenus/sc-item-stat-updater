import path from 'node:path';
import { formatScmdbDependencyAudit } from '../diagnostics/scmdb-dependency-audit';
import { formatSourceFreshnessDiagnostics } from '../diagnostics/source-freshness-diagnostics';
import { deployGlobalIni } from './deploy-global-ini';
import { refreshGlobalIni } from './refresh-global-ini';
import { refreshSourceCache, type SourceCacheSource } from './refresh-source-cache';
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
  onPhaseStart?: (phase: { id: string; label: string; detail?: string }) => void;
  onStepComplete?: (summary: string) => void;
  runUpdate?: typeof runBatchUpdate;
  refreshSourcesUseCase?: typeof refreshSourceCache;
  refresh?: typeof refreshGlobalIni;
  deploy?: typeof deployGlobalIni;
  onSourceStart?: (source: SourceCacheSource) => void;
  onSourceComplete?: (source: SourceCacheSource) => void;
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
  const startPhase = (phase: { id: string; label: string; detail?: string }, fallbackMessage: string): void => {
    if (options.onPhaseStart) {
      options.onPhaseStart(phase);
    } else {
      log(fallbackMessage);
    }
  };

  startPhase(
    { id: 'extract-global-ini', label: 'Extract global.ini', detail: 'fresh game localization' },
    '=== Step 1: Extracting global.ini from Data.p4k ===',
  );
  const { extractedGamePath } = await refresh({ repoIniPath, log });
  options.onStepComplete?.('global.ini extracted & synced to repo');

  if (shouldRefreshSources) {
    startPhase({ id: 'refresh-sources', label: 'Refresh source caches' }, '=== Step 2: Refreshing source caches ===');
    const cacheResult = await refreshSourcesUseCase({
      repoRoot: options.rootDir,
      target: options.datacore && !options.scrape ? 'datacore' : 'all',
      ptu: options.ptu,
      force: options.force ?? options.forceExtract,
      log,
      onSourceStart: options.onSourceStart,
      onSourceComplete: options.onSourceComplete,
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
    if (!options.onSourceComplete) {
      for (const source of cacheResult.refreshed) {
        options.onStepComplete?.(`${source.toUpperCase()} cache refreshed`);
      }
    }
  } else {
    startPhase(
      { id: 'use-cached-sources', label: 'Use cached source outputs' },
      '=== Step 2: Using cached source outputs ===',
    );
  }

  startPhase({ id: 'apply-updates', label: 'Apply localization updates' }, '=== Step 3: Applying stat updates ===');
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
    startPhase(
      { id: 'deploy-global-ini', label: 'Deploy global.ini', detail: 'copy enriched file to game folder' },
      '=== Step 4: Deploying updated global.ini -> game directory ===',
    );
    await deploy({ repoIniPath, targetIniPath: extractedGamePath });
    log(`Deployed: ${extractedGamePath}`);
    options.onStepComplete?.('global.ini deployed to game directory');
  } else {
    startPhase(
      { id: 'skip-deploy', label: 'Skip deployment', detail: '--repo-only' },
      '=== Step 4: Skipping deploy (--repo-only) ===',
    );
  }

  return { exitCode: 0, extractedGamePath, repoIniPath };
}
