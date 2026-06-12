import pLimit from 'p-limit';
import type { DataCoreTypeEntry } from './run-datacore-scrape';
import { runDatacoreScrape } from './run-datacore-scrape';
import { runScmdbScrape } from './run-scmdb-scrape';

export type SourceCacheTarget = 'all' | 'datacore' | 'scmdb';
export type SourceCacheSource = 'datacore' | 'scmdb';

export interface RefreshSourceCacheOptions {
  repoRoot: string;
  target?: SourceCacheTarget;
  concurrency?: number;
  ptu?: boolean;
  force?: boolean;
  log?: (message: string) => void;
  runDatacore?: typeof runDatacoreScrape;
  runScmdb?: typeof runScmdbScrape;
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
  onRawFactProgress?: (slug: string, current: number, total: number) => void;
  onTypeStart?: (entry: DataCoreTypeEntry, index: number) => void;
}

export interface RefreshSourceCacheResult {
  exitCode: number;
  refreshed: SourceCacheSource[];
}

export async function refreshSourceCache(options: RefreshSourceCacheOptions): Promise<RefreshSourceCacheResult> {
  const target = options.target ?? 'all';
  const log = options.log ?? (() => {});
  const runDatacore = options.runDatacore ?? runDatacoreScrape;
  const runScmdb = options.runScmdb ?? runScmdbScrape;
  const selectedSources = selectSources(target);
  const concurrency = Math.max(1, Math.min(options.concurrency ?? selectedSources.length, selectedSources.length));
  const limit = pLimit(concurrency);

  const results = await Promise.all(
    selectedSources.map((source) => limit(async () => refreshSource(source, options, runScmdb, runDatacore, log))),
  );
  const failed = results.find((result) => result.exitCode !== 0);

  return {
    exitCode: failed?.exitCode ?? 0,
    refreshed: results.filter((result) => result.exitCode === 0).map((result) => result.source),
  };
}

function selectSources(target: SourceCacheTarget): SourceCacheSource[] {
  if (target === 'scmdb') return ['scmdb'];
  if (target === 'datacore') return ['datacore'];
  return ['scmdb', 'datacore'];
}

async function refreshSource(
  source: SourceCacheSource,
  options: RefreshSourceCacheOptions,
  runScmdb: typeof runScmdbScrape,
  runDatacore: typeof runDatacoreScrape,
  log: (message: string) => void,
): Promise<{ source: SourceCacheSource; exitCode: number }> {
  if (source === 'scmdb') {
    if (options.onSourceStart) {
      options.onSourceStart('scmdb');
    } else {
      log('=== Refreshing SCMDB source cache ===');
    }
    await runScmdb({ repoRoot: options.repoRoot, ptu: options.ptu });
    options.onSourceComplete?.('scmdb');
    return { source, exitCode: 0 };
  }

  if (options.onSourceStart) {
    options.onSourceStart('datacore');
  } else {
    log('=== Refreshing DataCore source cache ===');
  }
  const datacoreResult = await runDatacore({
    repoRoot: options.repoRoot,
    ptu: options.ptu,
    forceExtract: options.force,
    onCacheHit: options.onCacheHit,
    onCacheExtractStart: options.onCacheExtractStart,
    onCacheExtractProgress: options.onCacheExtractProgress,
    onCacheExtractComplete: options.onCacheExtractComplete,
    onPrepared: options.onDatacorePrepared,
    onRecordGraphStart: options.onRecordGraphStart,
    onRecordGraphProgress: options.onRecordGraphProgress,
    onRecordGraphCacheHit: options.onRecordGraphCacheHit,
    onRawFactStart: options.onRawFactStart,
    onRawFactProgress: options.onRawFactProgress,
    onTypeStart: options.onTypeStart,
  });
  if (datacoreResult.exitCode === 0) {
    options.onSourceComplete?.('datacore');
  }

  return { source, exitCode: datacoreResult.exitCode };
}
