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

export type ProviderCoverageStatus = 'primary' | 'legacy/fallback' | 'unavailable';

export interface ProviderCoverageCell {
  status: ProviderCoverageStatus;
  slug?: string;
}

export interface ProviderCoverageRow {
  category: string;
  datacore: ProviderCoverageCell;
  spviewer: ProviderCoverageCell;
  scmdb: ProviderCoverageCell;
}

export interface ProviderCoverageMatrix {
  rows: ProviderCoverageRow[];
  mixedSources: MixedSourceListingEntry[];
}

function sourceFiles(config: ItemConfig): string[] {
  const primaryFiles = [config.csvFile, config.jsonFile, config.lookupCsvFile].filter((file): file is string => Boolean(file));
  const companionFiles = (config.sourceFiles ?? []).map((sourceFile) =>
    sourceFile.sourceDir && sourceFile.sourceDir !== 'csvDir'
      ? `${sourceFile.sourceDir}:${sourceFile.file}`
      : sourceFile.file,
  );
  return [...primaryFiles, ...companionFiles];
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

function stripProviderPrefix(label: string): string {
  return label.replace(/^(?:DC|SP) /, '');
}

function unavailableCell(): ProviderCoverageCell {
  return { status: 'unavailable' };
}

function coverageCell(status: Exclude<ProviderCoverageStatus, 'unavailable'>, slug: string): ProviderCoverageCell {
  return { status, slug };
}

export async function buildProviderCoverageMatrix(): Promise<ProviderCoverageMatrix> {
  const listing = await buildCategoryListing();
  const itemRows = new Map<string, ProviderCoverageRow>();
  const missionRows: ProviderCoverageRow[] = [];

  for (const entry of listing.categories) {
    if (entry.family === 'SCMDB') {
      missionRows.push({
        category: entry.label,
        datacore: unavailableCell(),
        spviewer: unavailableCell(),
        scmdb: coverageCell('primary', entry.slug),
      });
      continue;
    }

    const baseSlug = entry.slug.replace(/^(?:dc|sp)-/, '');
    const existing =
      itemRows.get(baseSlug) ??
      ({
        category: stripProviderPrefix(entry.label),
        datacore: unavailableCell(),
        spviewer: unavailableCell(),
        scmdb: unavailableCell(),
      } satisfies ProviderCoverageRow);

    if (entry.family === 'DataCore') {
      existing.datacore = coverageCell('primary', entry.slug);
      existing.category = stripProviderPrefix(entry.label);
    } else {
      existing.spviewer = coverageCell('legacy/fallback', entry.slug);
      if (!itemRows.has(baseSlug)) existing.category = stripProviderPrefix(entry.label);
    }
    itemRows.set(baseSlug, existing);
  }

  return {
    rows: [
      ...[...itemRows.values()].sort((a, b) => a.category.localeCompare(b.category)),
      ...missionRows.sort((a, b) => a.category.localeCompare(b.category)),
    ],
    mixedSources: listing.mixedSources,
  };
}

function formatSource(entry: CategoryListingEntry): string {
  const parts = [
    entry.sourceFiles.length > 0 ? entry.sourceFiles.join(', ') : undefined,
    entry.sourceHint,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('; ') : 'none declared';
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

function formatCoverageCell(cell: ProviderCoverageCell): string {
  return cell.slug ? `${cell.status} (${cell.slug})` : cell.status;
}

export function formatProviderCoverageMatrix(matrix: ProviderCoverageMatrix): string {
  const lines = [
    'Provider coverage matrix',
    '',
    'Legend: primary = preferred source, legacy/fallback = supported fallback source, unavailable = no category for that provider.',
    '',
    '| Category | DataCore | SPViewer | SCMDB |',
    '| --- | --- | --- | --- |',
  ];

  for (const row of matrix.rows) {
    lines.push(
      `| ${row.category} | ${formatCoverageCell(row.datacore)} | ${formatCoverageCell(row.spviewer)} | ${formatCoverageCell(row.scmdb)} |`,
    );
  }

  lines.push('', 'Mixed-source batch modes:', '| Command | Sources | Notes |', '| --- | --- | --- |');
  for (const entry of matrix.mixedSources) {
    lines.push(`| ${entry.command} | ${entry.families.join(' + ')} | ${entry.description} |`);
  }

  return lines.join('\n');
}
