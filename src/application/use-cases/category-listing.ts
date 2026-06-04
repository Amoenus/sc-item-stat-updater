import type { ItemConfig } from '../../enrichment/item-config';
import { loadDatacoreConfigs, loadMissionConfigs, loadSpviewerConfigs } from '../../items/registry';

export type CategoryListingFamily = 'SPViewer' | 'DataCore' | 'SCMDB';

export interface CategoryListingEntry {
  slug: string;
  label: string;
  family: CategoryListingFamily;
  sourceRoot: string;
  channelExpectation: string;
  sourceFiles: string[];
  sourceHint?: string;
  skippedByBatch: boolean;
}

export interface MixedSourceListingEntry {
  command: string;
  description: string;
  families: CategoryListingFamily[];
}

export interface CategoryListing {
  categories: CategoryListingEntry[];
  mixedSources: MixedSourceListingEntry[];
}

function sourceFiles(config: ItemConfig): string[] {
  return [config.csvFile, config.jsonFile, config.lookupCsvFile].filter((file): file is string => Boolean(file));
}

function sourceHint(config: ItemConfig): string | undefined {
  if (config.resolveJsonFile) {
    return 'dynamic JSON source resolved from the selected source directory';
  }
  if (sourceFiles(config).length === 0) {
    return 'source file is resolved by category logic';
  }
  return undefined;
}

function toEntries(
  configs: Map<string, ItemConfig>,
  family: CategoryListingFamily,
  sourceRoot: string,
): CategoryListingEntry[] {
  return [...configs.entries()]
    .map(([slug, config]) => ({
      slug,
      label: config.label,
      family,
      sourceRoot,
      channelExpectation: `${sourceRoot}/<latest LIVE or PTU version>`,
      sourceFiles: sourceFiles(config),
      sourceHint: sourceHint(config),
      skippedByBatch: config.skip === true,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function buildCategoryListing(): Promise<CategoryListing> {
  const [spviewer, datacore, missions] = await Promise.all([
    loadSpviewerConfigs(),
    loadDatacoreConfigs(),
    loadMissionConfigs(),
  ]);

  return {
    categories: [
      ...toEntries(spviewer, 'SPViewer', 'csv/spviewer'),
      ...toEntries(datacore, 'DataCore', 'csv/datacore'),
      ...toEntries(missions, 'SCMDB', 'csv/scmdb'),
    ],
    mixedSources: [
      {
        command: 'update-all --provider spviewer',
        description: 'SPViewer item categories plus SCMDB mission categories and extra SCMDB/SPViewer update steps',
        families: ['SPViewer', 'SCMDB'],
      },
      {
        command: 'update-all --provider datacore',
        description: 'DataCore item categories plus SCMDB mission categories',
        families: ['DataCore', 'SCMDB'],
      },
    ],
  };
}

function formatSource(entry: CategoryListingEntry): string {
  const files = entry.sourceFiles.length > 0 ? entry.sourceFiles.join(', ') : entry.sourceHint;
  return files ?? 'none declared';
}

function formatSection(title: CategoryListingFamily, entries: CategoryListingEntry[]): string[] {
  const lines = [`${title} categories:`];
  for (const entry of entries) {
    const batchNote = entry.skippedByBatch ? ' (extra step)' : '';
    lines.push(
      `  ${entry.slug}${batchNote} | ${entry.label} | files: ${formatSource(entry)} | source: ${entry.channelExpectation}`,
    );
  }
  return lines;
}

export function formatCategoryListing(listing: CategoryListing): string {
  const lines = ['Available update categories', ''];
  const families: CategoryListingFamily[] = ['SPViewer', 'DataCore', 'SCMDB'];

  for (const family of families) {
    lines.push(...formatSection(family, listing.categories.filter((entry) => entry.family === family)));
    lines.push('');
  }

  lines.push('Mixed-source batch modes:');
  for (const entry of listing.mixedSources) {
    lines.push(`  ${entry.command} | ${entry.families.join(' + ')} | ${entry.description}`);
  }

  return lines.join('\n');
}
