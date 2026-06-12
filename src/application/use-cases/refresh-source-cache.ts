import type { DataCoreTypeEntry } from './run-datacore-scrape';
import { runDatacoreScrape } from './run-datacore-scrape';
import { runScmdbScrape } from './run-scmdb-scrape';

export type SourceCacheTarget = 'all' | 'datacore' | 'scmdb';

export interface RefreshSourceCacheOptions {
  repoRoot: string;
  target?: SourceCacheTarget;
  ptu?: boolean;
  force?: boolean;
  log?: (message: string) => void;
  runDatacore?: typeof runDatacoreScrape;
  runScmdb?: typeof runScmdbScrape;
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

export interface RefreshSourceCacheResult {
  exitCode: number;
  refreshed: Array<'datacore' | 'scmdb'>;
}

export async function refreshSourceCache(options: RefreshSourceCacheOptions): Promise<RefreshSourceCacheResult> {
  const target = options.target ?? 'all';
  const log = options.log ?? (() => {});
  const runDatacore = options.runDatacore ?? runDatacoreScrape;
  const runScmdb = options.runScmdb ?? runScmdbScrape;
  const refreshed: Array<'datacore' | 'scmdb'> = [];

  if (target === 'all' || target === 'scmdb') {
    log('=== Refreshing SCMDB source cache ===');
    await runScmdb({ repoRoot: options.repoRoot, ptu: options.ptu });
    refreshed.push('scmdb');
  }

  if (target === 'all' || target === 'datacore') {
    log('=== Refreshing DataCore source cache ===');
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
    if (datacoreResult.exitCode !== 0) return { exitCode: datacoreResult.exitCode, refreshed };
    refreshed.push('datacore');
  }

  return { exitCode: 0, refreshed };
}
