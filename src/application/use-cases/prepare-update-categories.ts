import path from 'node:path';
import type { ItemConfig, ItemSourceDataContext } from '../../enrichment/item-config';
import { findLatestMatchingDirectory } from '../../io/local/discovery';
import { loadDatacoreConfigs, loadMissionConfigs } from '../../items/registry';
import { inferCategorySourceProvider } from '../source-contracts/category-source-contracts';

export type UpdateProvider = 'datacore';
export type UpdateSourceProvider = UpdateProvider | 'spviewer' | 'scmdb' | 'unknown';
export type UpdateChannel = 'LIVE' | 'PTU';

export interface UpdateSourceMetadata {
  provider: UpdateSourceProvider;
  channel: UpdateChannel;
  category: string;
}

export interface UpdateCategory {
  config: ItemConfig;
  csvDir: string;
  source?: UpdateSourceMetadata;
  sourceDirs?: ItemSourceDataContext['sourceDirs'];
}

export interface PrepareUpdateCategoriesOptions {
  repoRoot: string;
  provider: UpdateProvider;
  ptu?: boolean;
  csvDir?: string;
  scmdbVersionDir?: string;
  datacoreVersionDir?: string;
  sourceVersionMismatch?: SourceVersionMismatchPolicy;
}

export type SourceVersionMismatchPolicy = 'allow' | 'warn' | 'error';
export type SourceVersionCoherenceStatus = 'matched' | 'allowed-mismatch' | 'warning-mismatch' | 'hard-failure';

export interface PreparedSourceVersion {
  provider: 'scmdb' | UpdateProvider;
  version: string;
  path: string;
  pinned: boolean;
}

export interface SourceVersionCoherence {
  status: SourceVersionCoherenceStatus;
  policy: SourceVersionMismatchPolicy;
  message: string;
}

export interface SourceVersionLock {
  channel: UpdateChannel;
  sources: {
    scmdb: PreparedSourceVersion;
    datacore: PreparedSourceVersion;
  };
  coherence: SourceVersionCoherence;
}

export interface PreparedUpdateCategories {
  categories: UpdateCategory[];
  scmdbVersion: string;
  scmdbDir: string;
  itemVersion: string;
  itemVersionDir: string;
  missionCsvDir: string;
  sourceVersionLock?: SourceVersionLock;
}

export { inferCategorySourceProvider };

/**
 * Finds the latest versioned subfolder under a base directory that matches the
 * requested channel (live or ptu).
 *
 * SCMDB folders: "4.8.1-live.11875683"
 * DataCore folders: "4.8.1-live.11875683"
 */
export async function resolveLatestVersionDir(
  base: string,
  ptu: boolean,
  source: string,
  scraper: string,
): Promise<string> {
  const isMatch = ptu
    ? (name: string) => /\bptu\b/i.test(name) || /-ptu[.\b]/i.test(name) || name.endsWith('-ptu')
    : (name: string) => /\blive\b/i.test(name) || /-live[.\b]/i.test(name) || name.endsWith('-live');

  return findLatestMatchingDirectory(base, isMatch, {
    label: `${source} output directory`,
    notFoundMessage: `${source} output directory not found: ${base}. Run ${scraper}${ptu ? ' --ptu' : ''} first.`,
    noMatchMessage:
      `No ${ptu ? 'PTU' : 'LIVE'} ${source} version folder found under ${base}. ` +
      `Run ${scraper}${ptu ? ' --ptu' : ''} first.`,
  });
}

export async function prepareUpdateCategories(
  options: PrepareUpdateCategoriesOptions,
): Promise<PreparedUpdateCategories> {
  const ptu = options.ptu ?? false;
  const channel: UpdateChannel = ptu ? 'PTU' : 'LIVE';
  const mismatchPolicy = options.sourceVersionMismatch ?? 'warn';

  let scmdbDir: string;
  let scmdbVersion = '(custom)';
  let scmdbPinned = false;

  if (options.scmdbVersionDir ?? options.csvDir) {
    scmdbDir = options.scmdbVersionDir ?? options.csvDir ?? '';
    scmdbVersion = options.scmdbVersionDir ? path.basename(options.scmdbVersionDir) : '(custom)';
    scmdbPinned = true;
  } else {
    const scmdbBase = path.join(options.repoRoot, 'csv', 'scmdb');
    const versionDir = await resolveLatestVersionDir(scmdbBase, ptu, 'SCMDB', 'scrape-scmdb.js');
    scmdbDir = versionDir;
    scmdbVersion = path.basename(versionDir);
  }

  const datacoreBase = path.join(options.repoRoot, 'csv', 'datacore');
  const versionDir =
    options.datacoreVersionDir ?? (await resolveLatestVersionDir(datacoreBase, ptu, 'DataCore', 'scrape-datacore.js'));
  const itemVersionDir = versionDir;
  const itemVersion = path.basename(versionDir);
  const datacorePinned = Boolean(options.datacoreVersionDir);

  const missionCsvDir = scmdbDir;
  const sourceVersionLock = buildSourceVersionLock({
    channel,
    scmdb: { provider: 'scmdb', version: scmdbVersion, path: scmdbDir, pinned: scmdbPinned },
    datacore: {
      provider: 'datacore',
      version: itemVersion,
      path: itemVersionDir,
      pinned: datacorePinned,
    },
    policy: mismatchPolicy,
  });

  if (sourceVersionLock.coherence.status === 'hard-failure') {
    throw new Error(sourceVersionLock.coherence.message);
  }

  const datacoreConfigs = [...(await loadDatacoreConfigs()).entries()];
  const missionConfigs = [...(await loadMissionConfigs()).entries()].filter(([, config]) => !config.skip);

  const categories = [
    ...datacoreConfigs.map(([category, config]) => ({
      config,
      csvDir: itemVersionDir,
      source: { provider: 'datacore' as const, channel, category },
      sourceDirs: { datacore: itemVersionDir, scmdb: scmdbDir },
    })),
    ...missionConfigs.map(([category, config]) => ({
      config,
      csvDir: missionCsvDir,
      source: { provider: inferCategorySourceProvider(config, 'scmdb'), channel, category },
      sourceDirs: { datacore: itemVersionDir, scmdb: scmdbDir },
    })),
  ];

  return {
    categories,
    scmdbVersion,
    scmdbDir,
    itemVersion,
    itemVersionDir,
    missionCsvDir,
    sourceVersionLock,
  };
}

export function buildSourceVersionLock(options: {
  channel: UpdateChannel;
  scmdb: PreparedSourceVersion;
  datacore: PreparedSourceVersion;
  policy?: SourceVersionMismatchPolicy;
}): SourceVersionLock {
  const policy = options.policy ?? 'warn';
  const versionsMatch = options.scmdb.version === options.datacore.version;
  const mismatchIsPinned = options.scmdb.pinned || options.datacore.pinned;
  const mismatch = `SCMDB source version (${options.scmdb.version}) differs from DataCore (${options.datacore.version}).`;
  const guidance =
    'Refresh both caches for the same version, pin matching source directories, or choose an explicit mismatch policy.';

  let coherence: SourceVersionCoherence;
  if (versionsMatch) {
    coherence = {
      status: 'matched',
      policy,
      message: `SCMDB and DataCore source versions match (${options.datacore.version}).`,
    };
  } else if (mismatchIsPinned || policy === 'allow') {
    coherence = {
      status: 'allowed-mismatch',
      policy,
      message: `${mismatch} Mismatch is allowed because at least one source directory is explicitly pinned or mismatch policy is allow.`,
    };
  } else if (policy === 'error') {
    coherence = {
      status: 'hard-failure',
      policy,
      message: `${mismatch} ${guidance}`,
    };
  } else {
    coherence = {
      status: 'warning-mismatch',
      policy,
      message: `${mismatch} ${guidance}`,
    };
  }

  return {
    channel: options.channel,
    sources: {
      scmdb: options.scmdb,
      datacore: options.datacore,
    },
    coherence,
  };
}
