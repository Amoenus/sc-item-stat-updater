import fs from 'node:fs/promises';
import path from 'node:path';
import type { ItemConfig } from '../../enrichment/item-config';
import { loadDatacoreConfigs, loadMissionConfigs } from '../../items/registry';
import { inferCategorySourceProvider, type UpdateSourceProvider } from '../use-cases/prepare-update-categories';

export type DynamicCoverageStatus = 'dynamic' | 'needs-review' | 'known-source-gap';

export interface DynamicCoverageAuditEntry {
  slug: string;
  label: string;
  provider: UpdateSourceProvider;
  status: DynamicCoverageStatus;
  sourceFiles: string[];
  dynamicSignals: string[];
  reviewSignals: string[];
  sourceGapSignals: string[];
}

export interface DynamicCoverageAudit {
  goal: string;
  entries: DynamicCoverageAuditEntry[];
}

interface CategoryWithSource {
  slug: string;
  config: ItemConfig;
  sourcePath: string;
  fallbackProvider: UpdateSourceProvider;
}

const STATIC_SOURCE_MARKERS: Array<{ pattern: RegExp; signal: string }> = [
  { pattern: /locationKeyMap\.json/, signal: 'uses static location-key map' },
  { pattern: /\blookupCsvFile\b|\bloadMappingFile\b|\bsaveMappingFile\b/, signal: 'uses saved/static lookup mapping' },
  { pattern: /\bILLEGAL_[A-Z0-9_]+_KEYS\b/, signal: 'uses inline static key exception list' },
];

const GROUPING_MARKERS: Array<{ pattern: RegExp; signal: string }> = [
  {
    pattern: /\bgetOrCreateRow\b|\bgetOrCreate[A-Z]\w*\b/,
    signal: 'aggregates multiple source rows per localization key',
  },
  { pattern: /\bByDescriptionKey\b|\bbyDescriptionKey\b/, signal: 'groups facts by description/localization key' },
  { pattern: /Description Variant Keys/, signal: 'handles shared description variant keys' },
];

const DYNAMIC_TARGET_KEY_MARKERS: Array<{ pattern: RegExp; signal: string }> = [
  { pattern: /\bgetRawDataCoreTargetKeys\b/, signal: 'uses raw DataCore localization keys' },
  {
    pattern: /\bmakeGetTargetKeys\b|\bmakeGetTargetKeysFromPrefixMap\b/,
    signal: 'uses shared DataCore target-key derivation',
  },
  { pattern: /\bmakeAlternateDataCoreDescKeys\b/, signal: 'uses shared DataCore localization variant handling' },
];

function categorySourcePath(slug: string): string {
  const itemsDir = path.resolve(import.meta.dirname, '..', '..', 'items');
  if (slug.startsWith('mission-')) return path.join(itemsDir, 'missions', `${slug.slice('mission-'.length)}.ts`);
  if (slug.startsWith('dc-')) return path.join(itemsDir, 'datacore', `${slug.slice('dc-'.length)}.ts`);
  return path.join(itemsDir, `${slug}.ts`);
}

function declaredSourceFiles(config: ItemConfig): string[] {
  const usesDeclaredCustomSources = Boolean(config.loadSourceData && config.sourceFiles?.length);
  const primaryFiles = [
    usesDeclaredCustomSources ? undefined : config.csvFile,
    config.jsonFile,
    config.lookupCsvFile,
  ].filter((file): file is string => Boolean(file));
  const companionFiles =
    config.sourceFiles?.map((sourceFile) => {
      const sourceDir = sourceFile.sourceDir ?? 'csvDir';
      const prefix = sourceDir === 'csvDir' ? '' : `${sourceDir}:`;
      return `${sourceFile.optional ? 'optional:' : ''}${prefix}${sourceFile.file}`;
    }) ?? [];
  const dynamicJson = config.resolveJsonFile ? ['dynamic JSON resolver'] : [];
  return [...primaryFiles, ...dynamicJson, ...companionFiles];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function sourceSignals(
  config: ItemConfig,
  sourceText: string,
): Pick<DynamicCoverageAuditEntry, 'dynamicSignals' | 'reviewSignals' | 'sourceGapSignals' | 'status'> {
  const dynamicSignals: string[] = [];
  const reviewSignals: string[] = [];
  const sourceGapSignals: string[] = [];

  if (config.loadSourceData) dynamicSignals.push('custom source loader can join multiple extracted datasets');
  if (config.sourceFiles?.some((sourceFile) => sourceFile.sourceDir === 'datacore')) {
    dynamicSignals.push('declares DataCore source files');
  }
  if (config.getTargetKeys) dynamicSignals.push('targets localization keys from source rows');
  if (config.noInsert) dynamicSignals.push('degrades safely when localization key is absent');
  for (const marker of GROUPING_MARKERS) {
    if (marker.pattern.test(sourceText)) dynamicSignals.push(marker.signal);
  }
  const usesKnownDynamicTargetKeyHelpers = DYNAMIC_TARGET_KEY_MARKERS.some((marker) => marker.pattern.test(sourceText));
  for (const marker of DYNAMIC_TARGET_KEY_MARKERS) {
    if (marker.pattern.test(sourceText)) dynamicSignals.push(marker.signal);
  }

  if (config.lookupCsvFile) reviewSignals.push('declares lookup CSV mapping');
  if ((config.getAlternateDescKeys || config.nameKeyToDescKey) && !usesKnownDynamicTargetKeyHelpers) {
    reviewSignals.push('uses category-specific target-key derivation');
  }
  for (const marker of STATIC_SOURCE_MARKERS) {
    if (marker.pattern.test(sourceText)) reviewSignals.push(marker.signal);
  }

  const provider = inferCategorySourceProvider(config, 'scmdb');
  if (provider === 'scmdb') {
    sourceGapSignals.push('still uses SCMDB bridge because equivalent DataCore join is not active');
  }
  if (provider === 'spviewer') {
    sourceGapSignals.push('retired SPViewer source is outside the active DataCore graph');
  }

  const status: DynamicCoverageStatus =
    sourceGapSignals.length > 0 ? 'known-source-gap' : reviewSignals.length > 0 ? 'needs-review' : 'dynamic';

  return {
    dynamicSignals: unique(dynamicSignals),
    reviewSignals: unique(reviewSignals),
    sourceGapSignals: unique(sourceGapSignals),
    status,
  };
}

async function buildEntry(category: CategoryWithSource): Promise<DynamicCoverageAuditEntry> {
  let sourceText = '';
  try {
    sourceText = await fs.readFile(category.sourcePath, 'utf8');
  } catch {
    sourceText = '';
  }
  const signals = sourceSignals(category.config, sourceText);
  return {
    slug: category.slug,
    label: category.config.label,
    provider: inferCategorySourceProvider(category.config, category.fallbackProvider),
    sourceFiles: declaredSourceFiles(category.config),
    ...signals,
  };
}

export async function buildDynamicCoverageAudit(): Promise<DynamicCoverageAudit> {
  const [datacoreConfigs, missionConfigs] = await Promise.all([loadDatacoreConfigs(), loadMissionConfigs()]);
  const categories: CategoryWithSource[] = [
    ...[...datacoreConfigs.entries()].map(([slug, config]) => ({
      slug,
      config,
      sourcePath: categorySourcePath(slug),
      fallbackProvider: 'datacore' as const,
    })),
    ...[...missionConfigs.entries()].map(([slug, config]) => ({
      slug,
      config,
      sourcePath: categorySourcePath(slug),
      fallbackProvider: 'scmdb' as const,
    })),
  ];

  const entries = await Promise.all(categories.map(buildEntry));
  return {
    goal: 'Prefer DataCore graph-derived facts, treat global.ini as a localization target, and keep SCMDB limited to documented enhancement or source-gap data.',
    entries: entries.sort((a, b) => a.slug.localeCompare(b.slug)),
  };
}

function formatSignals(signals: string[]): string {
  return signals.length > 0 ? signals.join('; ') : 'none';
}

export function formatDynamicCoverageAudit(audit: DynamicCoverageAudit): string {
  const lines = [
    'Dynamic coverage audit',
    '',
    audit.goal,
    '',
    '| Category | Provider | Status | Sources | Dynamic signals | Review/source-gap signals |',
    '| --- | --- | --- | --- | --- | --- |',
  ];

  for (const entry of audit.entries) {
    const caveats = [...entry.reviewSignals, ...entry.sourceGapSignals];
    lines.push(
      `| ${entry.slug} (${entry.label}) | ${entry.provider} | ${entry.status} | ${
        entry.sourceFiles.join(', ') || 'source resolved by category logic'
      } | ${formatSignals(entry.dynamicSignals)} | ${formatSignals(caveats)} |`,
    );
  }

  const grouped = {
    dynamic: audit.entries.filter((entry) => entry.status === 'dynamic').length,
    needsReview: audit.entries.filter((entry) => entry.status === 'needs-review').length,
    knownSourceGap: audit.entries.filter((entry) => entry.status === 'known-source-gap').length,
  };
  lines.push(
    '',
    `Summary: ${grouped.dynamic} dynamic, ${grouped.needsReview} need review, ${grouped.knownSourceGap} known source gaps.`,
  );

  return lines.join('\n');
}
