import type { ItemConfig } from '../../enrichment/item-config';
import { loadDatacoreConfigs, loadMissionConfigs, loadSpviewerConfigs } from '../../items/registry';
import { inferCategorySourceProvider } from './prepare-update-categories';

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

export interface RawFactListingEntry {
  slug: string;
  label: string;
  family: 'DataCore';
  sourceRoot: string;
  sourceFiles: string[];
  description: string;
}

export interface CategoryListing {
  categories: CategoryListingEntry[];
  rawFacts: RawFactListingEntry[];
  mixedSources: MixedSourceListingEntry[];
}

export type ProviderCoverageStatus = 'primary' | 'derived bridge' | 'legacy comparison' | 'unavailable';

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

function sourceFiles(config: ItemConfig, csvDirProvider?: CategoryListingFamily): string[] {
  const usesDeclaredCustomSources = Boolean(config.loadSourceData && config.sourceFiles?.length);
  const primaryFiles = [
    usesDeclaredCustomSources ? undefined : config.csvFile,
    config.jsonFile,
    config.lookupCsvFile,
  ].filter((file): file is string => Boolean(file));
  const companionFiles = (config.sourceFiles ?? []).map((sourceFile) => {
    const sourceDir = sourceFile.sourceDir ?? 'csvDir';
    const provider = sourceDir === 'csvDir' ? csvDirProvider?.toLowerCase() : sourceDir;
    const providerPrefix = provider ? `${provider}:` : '';
    return `${sourceFile.optional ? 'optional:' : ''}${providerPrefix}${sourceFile.file}`;
  });
  return [...primaryFiles, ...companionFiles];
}

function sourceHint(config: ItemConfig, csvDirProvider?: CategoryListingFamily): string | undefined {
  if (config.resolveJsonFile) {
    return 'dynamic JSON source resolved from the selected source directory';
  }
  if (sourceFiles(config, csvDirProvider).length === 0) {
    return 'source file is resolved by category logic';
  }
  return undefined;
}

function toEntries(
  configs: Map<string, ItemConfig>,
  family: CategoryListingFamily,
  sourceRoot: string,
  csvDirProvider?: CategoryListingFamily,
): CategoryListingEntry[] {
  return [...configs.entries()]
    .map(([slug, config]) => ({
      slug,
      label: config.label,
      family,
      sourceRoot,
      channelExpectation: `${sourceRoot}/<latest LIVE or PTU version>`,
      sourceFiles: sourceFiles(config, csvDirProvider),
      sourceHint: sourceHint(config, csvDirProvider),
      skippedByBatch: config.skip === true,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export const DATACORE_RAW_FACTS: RawFactListingEntry[] = [
  {
    slug: 'datacore-contract-generators',
    label: 'Contract generator variants',
    family: 'DataCore',
    sourceRoot: 'csv/datacore',
    sourceFiles: ['contract-generators.datacore.csv'],
    description: 'first-party generated contract variants, title/description overrides, timing, and location tags',
  },
  {
    slug: 'datacore-contract-generator-intel',
    label: 'Contract generator intel',
    family: 'DataCore',
    sourceRoot: 'csv/datacore',
    sourceFiles: ['contract-generator-intel.datacore.csv'],
    description: 'DataCore-derived generated-contract time limit and buy-in text',
  },
  {
    slug: 'datacore-contract-templates',
    label: 'Contract templates',
    family: 'DataCore',
    sourceRoot: 'csv/datacore',
    sourceFiles: ['contract-templates.datacore.csv'],
    description: 'first-party contract template display settings, objective keys, and location tags',
  },
  {
    slug: 'datacore-contract-template-hauling',
    label: 'Contract template hauling',
    family: 'DataCore',
    sourceRoot: 'csv/datacore',
    sourceFiles: ['contract-template-hauling.datacore.csv'],
    description: 'first-party contract template hauling orders and cargo resource refs',
  },
  {
    slug: 'datacore-commodities',
    label: 'Commodities',
    family: 'DataCore',
    sourceRoot: 'csv/datacore',
    sourceFiles: ['commodities.datacore.csv'],
    description: 'first-party commodity identity, cargo occupancy, and trade flags',
  },
  {
    slug: 'datacore-vehicles',
    label: 'Vehicles',
    family: 'DataCore',
    sourceRoot: 'csv/datacore',
    sourceFiles: ['vehicles.datacore.csv'],
    description: 'first-party vehicle labels, manufacturer refs, roles, and vehicle metadata',
  },
  {
    slug: 'datacore-manufacturers',
    label: 'Manufacturers',
    family: 'DataCore',
    sourceRoot: 'csv/datacore',
    sourceFiles: ['manufacturers.datacore.csv'],
    description: 'first-party manufacturer identity, localization, logo, and style refs',
  },
  {
    slug: 'datacore-factions',
    label: 'Factions and reputation',
    family: 'DataCore',
    sourceRoot: 'csv/datacore',
    sourceFiles: ['factions.datacore.csv'],
    description: 'first-party faction flags, reputation UI keys, and relationship refs',
  },
  {
    slug: 'datacore-location-labels',
    label: 'Law and location labels',
    family: 'DataCore',
    sourceRoot: 'csv/datacore',
    sourceFiles: ['location-labels.datacore.csv'],
    description: 'first-party StarMap labels, affiliation refs, and jurisdiction refs',
  },
  {
    slug: 'datacore-mission-localization',
    label: 'Mission localization references',
    family: 'DataCore',
    sourceRoot: 'csv/datacore',
    sourceFiles: ['mission-localization.datacore.csv'],
    description: 'first-party mission and contract localization references from record graph',
  },
  {
    slug: 'datacore-mission-brokers',
    label: 'Mission broker records',
    family: 'DataCore',
    sourceRoot: 'csv/datacore',
    sourceFiles: ['mission-brokers.datacore.csv'],
    description: 'first-party mission broker rewards, timing, flags, and localization keys',
  },
  {
    slug: 'datacore-mission-contract-intel',
    label: 'Mission contract intel',
    family: 'DataCore',
    sourceRoot: 'csv/datacore',
    sourceFiles: ['mission-contract-intel.datacore.csv'],
    description: 'DataCore-derived mission reward, time limit, efficiency, and cooldown text',
  },
  {
    slug: 'datacore-mining-location-labels',
    label: 'Mining location labels',
    family: 'DataCore',
    sourceRoot: 'csv/datacore',
    sourceFiles: ['mining-location-labels.datacore.csv'],
    description: 'mining-scoped StarMap labels linked to mining quality and location facts',
  },
];

export async function buildCategoryListing(): Promise<CategoryListing> {
  const [spviewer, datacore, missions] = await Promise.all([
    loadSpviewerConfigs(),
    loadDatacoreConfigs(),
    loadMissionConfigs(),
  ]);
  const missionEntries = [...missions.entries()];
  const datacoreBackedMissions = new Map(
    missionEntries.filter(([, config]) => inferCategorySourceProvider(config, 'scmdb') === 'datacore'),
  );
  const scmdbBackedMissions = new Map(
    missionEntries.filter(([, config]) => inferCategorySourceProvider(config, 'scmdb') === 'scmdb'),
  );

  return {
    categories: [
      ...toEntries(spviewer, 'SPViewer', 'csv/spviewer'),
      ...toEntries(datacore, 'DataCore', 'csv/datacore'),
      ...toEntries(datacoreBackedMissions, 'DataCore', 'csv/datacore', 'SCMDB'),
      ...toEntries(scmdbBackedMissions, 'SCMDB', 'csv/scmdb'),
    ],
    rawFacts: DATACORE_RAW_FACTS,
    mixedSources: [
      {
        command: 'update-all',
        description: 'DataCore item categories plus remaining SCMDB-derived mission bridges',
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
        scmdb: coverageCell('derived bridge', entry.slug),
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
      existing.spviewer = coverageCell('legacy comparison', entry.slug);
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
  const parts = [entry.sourceFiles.length > 0 ? entry.sourceFiles.join(', ') : undefined, entry.sourceHint].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join('; ') : 'none declared';
}

function sectionTitle(family: CategoryListingFamily): string {
  if (family === 'SPViewer') return 'SPViewer diagnostic categories:';
  if (family === 'SCMDB') return 'SCMDB derived bridge categories:';
  return 'DataCore active categories:';
}

function formatSection(family: CategoryListingFamily, entries: CategoryListingEntry[]): string[] {
  const lines = [sectionTitle(family)];
  for (const entry of entries) {
    const batchNote = entry.skippedByBatch ? ' (extra step)' : '';
    lines.push(
      `  ${entry.slug}${batchNote} | ${entry.label} | files: ${formatSource(entry)} | source: ${entry.channelExpectation}`,
    );
  }
  return lines;
}

function formatRawFactSection(entries: RawFactListingEntry[]): string[] {
  const lines = ['DataCore raw fact datasets:'];
  for (const entry of entries) {
    lines.push(
      `  ${entry.slug} | ${entry.label} | files: ${entry.sourceFiles.join(', ')} | ${entry.description} | source: ${
        entry.sourceRoot
      }/<latest LIVE or PTU version>`,
    );
  }
  return lines;
}

export function formatCategoryListing(listing: CategoryListing): string {
  const lines = ['Category inventory', ''];
  const families: CategoryListingFamily[] = ['SPViewer', 'DataCore', 'SCMDB'];

  for (const family of families) {
    lines.push(
      ...formatSection(
        family,
        listing.categories.filter((entry) => entry.family === family),
      ),
    );
    lines.push('');
  }

  lines.push(...formatRawFactSection(listing.rawFacts));
  lines.push('');

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
    'Legend: primary = preferred first-party source, derived bridge = temporary generated/relationship source, legacy comparison = audit-only comparison source, unavailable = no category for that provider.',
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
