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
}

export interface PreparedUpdateCategories {
  categories: UpdateCategory[];
  scmdbVersion: string;
  scmdbDir: string;
  itemVersion: string;
  itemVersionDir: string;
  missionCsvDir: string;
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

  let scmdbDir: string;
  let scmdbVersion = '(custom)';

  if (options.csvDir) {
    scmdbDir = options.csvDir;
  } else {
    const scmdbBase = path.join(options.repoRoot, 'csv', 'scmdb');
    const versionDir = await resolveLatestVersionDir(scmdbBase, ptu, 'SCMDB', 'scrape-scmdb.js');
    scmdbDir = versionDir;
    scmdbVersion = path.basename(versionDir);
  }

  const datacoreBase = path.join(options.repoRoot, 'csv', 'datacore');
  const versionDir = await resolveLatestVersionDir(datacoreBase, ptu, 'DataCore', 'scrape-datacore.js');
  const itemVersionDir = versionDir;
  const itemVersion = path.basename(versionDir);

  const missionCsvDir = scmdbDir;
  const channel: UpdateChannel = ptu ? 'PTU' : 'LIVE';

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
  };
}
