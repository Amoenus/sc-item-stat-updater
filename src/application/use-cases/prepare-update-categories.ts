import path from 'node:path';
import { findLatestMatchingDirectory } from '../../io/local/discovery';
import { loadDatacoreConfigs, loadMissionConfigs, loadSpviewerConfigs } from '../../items/registry';
import type { ItemConfig } from '../../lib/types';

export type UpdateProvider = 'spviewer' | 'datacore';

export interface UpdateCategory {
  config: ItemConfig;
  csvDir: string;
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
  spviewerVersionDir?: string;
}

/**
 * Finds the latest versioned subfolder under a base directory that matches the
 * requested channel (live or ptu).
 *
 * SCMDB folders: "4.1.1-live.9800000" or "4.2.0-ptu.9900000"
 * SPViewer folders: "4.7.2.11715810-live" or "4.8.0.11768487-ptu"
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

  let itemVersionDir: string;
  let itemVersion: string;

  if (options.provider === 'datacore') {
    const datacoreBase = path.join(options.repoRoot, 'csv', 'datacore');
    const versionDir = await resolveLatestVersionDir(datacoreBase, ptu, 'DataCore', 'scrape-datacore.js');
    itemVersionDir = versionDir;
    itemVersion = path.basename(versionDir);
  } else {
    const spviewerBase = path.join(options.repoRoot, 'csv', 'spviewer');
    const versionDir = await resolveLatestVersionDir(spviewerBase, ptu, 'SPViewer', 'scrape-spviewer.js');
    itemVersionDir = versionDir;
    itemVersion = path.basename(versionDir);
  }

  const spviewerVersionDir = options.provider === 'spviewer' ? itemVersionDir : undefined;
  const missionCsvDir = scmdbDir;

  const spviewerConfigs = options.provider === 'spviewer' ? [...(await loadSpviewerConfigs()).values()] : [];
  const datacoreConfigs = options.provider === 'datacore' ? [...(await loadDatacoreConfigs()).values()] : [];
  const missionConfigs = [...(await loadMissionConfigs()).values()].filter((config) => !config.skip);

  const categories = [
    ...spviewerConfigs.map((config) => ({ config, csvDir: itemVersionDir })),
    ...datacoreConfigs.map((config) => ({ config, csvDir: itemVersionDir })),
    ...missionConfigs.map((config) => ({ config, csvDir: missionCsvDir })),
  ];

  return {
    categories,
    scmdbVersion,
    scmdbDir,
    itemVersion,
    itemVersionDir,
    missionCsvDir,
    spviewerVersionDir,
  };
}
