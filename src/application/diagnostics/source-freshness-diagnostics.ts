import fs from 'node:fs/promises';
import type { ItemSourceFileDeclaration } from '../../enrichment/item-config';
import { readCsvFile } from '../../io/local/csv-parser';
import { resolveChildPath } from '../../io/local/path-conventions';
import { DATACORE_RAW_FACTS, type RawFactListingEntry } from '../catalog/category-listing';
import type {
  PreparedUpdateCategories,
  UpdateCategory,
  UpdateChannel,
  UpdateProvider,
  UpdateSourceProvider,
} from '../use-cases/prepare-update-categories';

export interface SourceVersionDiagnostic {
  provider: UpdateSourceProvider;
  label: string;
  channel: UpdateChannel;
  version: string;
  path: string;
}

export interface SourceFreshnessWarning {
  provider: UpdateSourceProvider;
  label: string;
  channel?: UpdateChannel;
  category?: string;
  path: string;
  message: string;
}

export interface DataCoreRawFactDiagnostic {
  slug: string;
  label: string;
  channel: UpdateChannel;
  rows: number;
  csvFile: string;
  path: string;
}

export interface DataCoreItemIdentityDiagnostic {
  category: string;
  label: string;
  channel: UpdateChannel;
  rows: number;
  rowsWithNameKey: number;
  rowsWithDescriptionKey: number;
  rowsWithRawTargetKey: number;
  requiredColumns: number;
  fullyPopulatedRequiredColumns: number;
  emptyRequiredColumns: string[];
  partialRequiredColumns: Array<{ column: string; rows: number }>;
  csvFile: string;
  path: string;
}

export interface SourceFreshnessDiagnostics {
  versions: SourceVersionDiagnostic[];
  warnings: SourceFreshnessWarning[];
  rawFacts?: DataCoreRawFactDiagnostic[];
  itemIdentity?: DataCoreItemIdentityDiagnostic[];
}

function providerLabel(provider: UpdateSourceProvider): string {
  switch (provider) {
    case 'datacore':
      return 'DataCore';
    case 'scmdb':
      return 'SCMDB';
    case 'spviewer':
      return 'SPViewer';
    case 'unknown':
      return 'Unknown';
  }
}

function itemProviderLabel(provider: UpdateProvider): string {
  return providerLabel(provider);
}

function expectedChannel(ptu?: boolean): UpdateChannel {
  return ptu ? 'PTU' : 'LIVE';
}

function looksLikeRequestedChannel(version: string, channel: UpdateChannel): boolean {
  if (version === '(custom)') return true;
  return channel === 'PTU' ? /\bptu\b|[-.]ptu\b/i.test(version) : /\blive\b|[-.]live\b/i.test(version);
}

function categoryProvider(category: UpdateCategory): UpdateSourceProvider {
  if (category.source) return category.source.provider;
  const haystack = [
    category.config.csvFile,
    category.config.jsonFile,
    category.config.lookupCsvFile,
    ...(category.config.sourceFiles ?? []).map((sourceFile) => `${sourceFile.sourceDir ?? ''} ${sourceFile.file}`),
    category.csvDir,
  ]
    .filter(Boolean)
    .join(' ');
  if (/\bdatacore\b|\.datacore\./i.test(haystack)) return 'datacore';
  if (/\bscmdb\b|mission/i.test(haystack)) return 'scmdb';
  if (/\bspviewer\b|\.spviewer\./i.test(haystack)) return 'spviewer';
  return 'unknown';
}

function providerFromSourceDir(sourceDir: ItemSourceFileDeclaration['sourceDir']): UpdateSourceProvider | undefined {
  if (sourceDir === 'datacore' || sourceDir === 'scmdb' || sourceDir === 'spviewer') return sourceDir;
  return undefined;
}

function resolveDeclaredSourceFiles(
  category: UpdateCategory,
): Array<{ filename: string; baseDir: string; provider?: UpdateSourceProvider; optional?: boolean }> {
  const usesDeclaredCustomSources = Boolean(category.config.loadSourceData && category.config.sourceFiles?.length);
  const staticFiles = [
    usesDeclaredCustomSources ? undefined : category.config.csvFile,
    category.config.jsonFile,
    category.config.lookupCsvFile,
  ]
    .filter((filename): filename is string => typeof filename === 'string')
    .map((filename) => ({ filename, baseDir: category.csvDir, provider: category.source?.provider }));

  const companionFiles = (category.config.sourceFiles ?? []).flatMap((sourceFile) => {
    const sourceDir = sourceFile.sourceDir ?? 'csvDir';
    const baseDir = sourceDir === 'csvDir' ? category.csvDir : category.sourceDirs?.[sourceDir];
    if (!baseDir) return [];
    return [
      { filename: sourceFile.file, baseDir, provider: providerFromSourceDir(sourceDir), optional: sourceFile.optional },
    ];
  });

  return [...staticFiles, ...companionFiles];
}

async function collectIncompleteSourceWarnings(category: UpdateCategory): Promise<SourceFreshnessWarning[]> {
  const sourceFiles = resolveDeclaredSourceFiles(category);
  const warnings = await Promise.all(
    sourceFiles.map(async ({ filename, baseDir, provider: fileProvider, optional }) => {
      const sourcePath = resolveChildPath(baseDir, filename, 'source file');
      try {
        await fs.access(sourcePath);
        return null;
      } catch {
        if (optional) return null;
        const provider = fileProvider ?? categoryProvider(category);
        const label = providerLabel(provider);
        const warning: SourceFreshnessWarning = {
          provider,
          label,
          channel: category.source?.channel,
          category: category.source?.category ?? category.config.label,
          path: sourcePath,
          message: `${label} source data appears incomplete; expected source file is missing.`,
        };
        return warning;
      }
    }),
  );
  return warnings.filter((warning): warning is SourceFreshnessWarning => warning !== null);
}

async function collectRawFactWarnings(
  rawFact: RawFactListingEntry,
  options: { baseDir: string; channel: UpdateChannel },
): Promise<SourceFreshnessWarning[]> {
  const warnings = await Promise.all(
    rawFact.sourceFiles.map(async (filename) => {
      const sourcePath = resolveChildPath(options.baseDir, filename, 'DataCore raw fact source file');
      try {
        const contents = await fs.readFile(sourcePath, 'utf8');
        if (countCsvDataRows(contents) > 0) return null;
        const warning: SourceFreshnessWarning = {
          provider: 'datacore',
          label: 'DataCore',
          channel: options.channel,
          category: rawFact.slug,
          path: sourcePath,
          message: 'DataCore raw fact data appears incomplete; expected at least one data row.',
        };
        return warning;
      } catch {
        const warning: SourceFreshnessWarning = {
          provider: 'datacore',
          label: 'DataCore',
          channel: options.channel,
          category: rawFact.slug,
          path: sourcePath,
          message: 'DataCore raw fact data appears incomplete; expected source file is missing.',
        };
        return warning;
      }
    }),
  );
  return warnings.filter((warning): warning is SourceFreshnessWarning => warning !== null);
}

async function collectRawFactDiagnostics(
  rawFact: RawFactListingEntry,
  options: { baseDir: string; channel: UpdateChannel },
): Promise<DataCoreRawFactDiagnostic[]> {
  const diagnostics = await Promise.all(
    rawFact.sourceFiles.map(async (filename) => {
      const sourcePath = resolveChildPath(options.baseDir, filename, 'DataCore raw fact source file');
      try {
        const contents = await fs.readFile(sourcePath, 'utf8');
        return {
          slug: rawFact.slug,
          label: rawFact.label,
          channel: options.channel,
          rows: countCsvDataRows(contents),
          csvFile: filename,
          path: sourcePath,
        };
      } catch {
        return null;
      }
    }),
  );
  return diagnostics.filter((diagnostic): diagnostic is DataCoreRawFactDiagnostic => diagnostic !== null);
}

async function collectDataCoreItemIdentityDiagnostic(
  category: UpdateCategory,
): Promise<DataCoreItemIdentityDiagnostic | null> {
  if (category.source?.provider !== 'datacore' || !category.config.csvFile || !category.source.channel) return null;
  if (category.config.loadSourceData && category.config.sourceFiles?.length) return null;

  const sourcePath = resolveChildPath(category.csvDir, category.config.csvFile, 'DataCore item source file');
  try {
    const rows = await readCsvFile(sourcePath);
    const rowsWithNameKey = rows.filter((row) => isUsableLocalizationKey(row['Name Key'])).length;
    const rowsWithDescriptionKey = rows.filter((row) => isUsableLocalizationKey(row['Description Key'])).length;
    const requiredColumnCoverage = collectRequiredColumnCoverage(rows, category.config.requiredColumns ?? []);
    return {
      category: category.source.category,
      label: category.config.label,
      channel: category.source.channel,
      rows: rows.length,
      rowsWithNameKey,
      rowsWithDescriptionKey,
      rowsWithRawTargetKey: rows.filter(
        (row) => isUsableLocalizationKey(row['Name Key']) || isUsableLocalizationKey(row['Description Key']),
      ).length,
      ...requiredColumnCoverage,
      csvFile: category.config.csvFile,
      path: sourcePath,
    };
  } catch {
    return null;
  }
}

function collectRequiredColumnCoverage(
  rows: Record<string, string>[],
  requiredColumns: string[],
): Pick<
  DataCoreItemIdentityDiagnostic,
  'requiredColumns' | 'fullyPopulatedRequiredColumns' | 'emptyRequiredColumns' | 'partialRequiredColumns'
> {
  const coverage = requiredColumns.map((column) => ({
    column,
    rows: rows.filter((row) => hasValue(row[column])).length,
  }));
  return {
    requiredColumns: coverage.length,
    fullyPopulatedRequiredColumns: coverage.filter((entry) => entry.rows === rows.length).length,
    emptyRequiredColumns: coverage.filter((entry) => entry.rows === 0).map((entry) => entry.column),
    partialRequiredColumns: coverage.filter((entry) => entry.rows > 0 && entry.rows < rows.length),
  };
}

function collectDataCoreItemIdentityWarnings(diagnostics: DataCoreItemIdentityDiagnostic[]): SourceFreshnessWarning[] {
  return diagnostics
    .filter((diagnostic) => diagnostic.rows > 0 && diagnostic.rowsWithRawTargetKey === 0)
    .map((diagnostic) => ({
      provider: 'datacore',
      label: 'DataCore',
      channel: diagnostic.channel,
      category: diagnostic.category,
      path: diagnostic.path,
      message:
        'DataCore item identity data appears incomplete; expected at least one usable Name Key or Description Key.',
    }));
}

function countCsvDataRows(contents: string): number {
  const nonEmptyLines = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return Math.max(0, nonEmptyLines.length - 1);
}

function isUsableLocalizationKey(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 && trimmed !== 'LOC_EMPTY' && trimmed !== 'LOC_UNINITIALIZED';
}

function hasValue(value: string | undefined): boolean {
  return (value?.trim() ?? '').length > 0;
}

function dedupeWarningsByPath(warnings: SourceFreshnessWarning[]): SourceFreshnessWarning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.provider}:${warning.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function buildSourceFreshnessDiagnostics(
  prepared: PreparedUpdateCategories,
  options: { provider: UpdateProvider; ptu?: boolean },
): Promise<SourceFreshnessDiagnostics> {
  const channel = expectedChannel(options.ptu);
  const versions: SourceVersionDiagnostic[] = [
    {
      provider: 'scmdb',
      label: 'SCMDB',
      channel,
      version: prepared.scmdbVersion,
      path: prepared.scmdbDir,
    },
    {
      provider: options.provider,
      label: itemProviderLabel(options.provider),
      channel,
      version: prepared.itemVersion,
      path: prepared.itemVersionDir,
    },
  ];

  const staleWarnings: SourceFreshnessWarning[] = versions
    .filter((source) => !looksLikeRequestedChannel(source.version, source.channel))
    .map((source) => ({
      provider: source.provider,
      label: source.label,
      channel: source.channel,
      path: source.path,
      message: `${source.label} source version does not look like ${source.channel} data.`,
    }));
  const scmdbVersion = versions.find((source) => source.provider === 'scmdb');
  const itemVersion = versions.find((source) => source.provider === options.provider);
  const versionMismatchWarnings: SourceFreshnessWarning[] =
    scmdbVersion &&
    itemVersion &&
    scmdbVersion.version !== '(custom)' &&
    itemVersion.version !== '(custom)' &&
    scmdbVersion.version !== itemVersion.version
      ? [
          {
            provider: itemVersion.provider,
            label: itemVersion.label,
            channel: itemVersion.channel,
            path: itemVersion.path,
            message: `${itemVersion.label} source version (${itemVersion.version}) differs from SCMDB (${scmdbVersion.version}).`,
          },
        ]
      : [];

  const categoryWarnings = (await Promise.all(prepared.categories.map(collectIncompleteSourceWarnings))).flat();
  const rawFactWarnings =
    options.provider === 'datacore'
      ? (
          await Promise.all(
            DATACORE_RAW_FACTS.map((rawFact) =>
              collectRawFactWarnings(rawFact, { baseDir: prepared.itemVersionDir, channel }),
            ),
          )
        ).flat()
      : [];
  const rawFacts =
    options.provider === 'datacore'
      ? (
          await Promise.all(
            DATACORE_RAW_FACTS.map((rawFact) =>
              collectRawFactDiagnostics(rawFact, { baseDir: prepared.itemVersionDir, channel }),
            ),
          )
        ).flat()
      : undefined;
  const itemIdentity =
    options.provider === 'datacore'
      ? (
          await Promise.all(prepared.categories.map((category) => collectDataCoreItemIdentityDiagnostic(category)))
        ).filter((diagnostic): diagnostic is DataCoreItemIdentityDiagnostic => diagnostic !== null)
      : undefined;
  const itemIdentityWarnings = itemIdentity ? collectDataCoreItemIdentityWarnings(itemIdentity) : [];
  const incompleteWarnings = dedupeWarningsByPath([...categoryWarnings, ...rawFactWarnings, ...itemIdentityWarnings]);
  return { versions, warnings: [...staleWarnings, ...versionMismatchWarnings, ...incompleteWarnings], rawFacts, itemIdentity };
}

export function formatSourceFreshnessDiagnostics(diagnostics: SourceFreshnessDiagnostics): string {
  const lines = ['Source data:'];
  for (const source of diagnostics.versions) {
    lines.push(`  ${source.label} (${source.channel}): ${source.version}`);
    lines.push(`    Path: ${source.path}`);
  }
  if ((diagnostics.rawFacts ?? []).length > 0) {
    lines.push('DataCore raw fact datasets:');
    for (const rawFact of diagnostics.rawFacts ?? []) {
      lines.push(`  ${rawFact.slug} | ${rawFact.label} | ${rawFact.rows} rows | ${rawFact.csvFile}`);
      lines.push(`    Path: ${rawFact.path}`);
    }
  }
  if ((diagnostics.itemIdentity ?? []).length > 0) {
    lines.push('DataCore item identity coverage:');
    for (const item of diagnostics.itemIdentity ?? []) {
      lines.push(
        `  ${item.category} | ${item.label} | ${item.rowsWithRawTargetKey}/${item.rows} rows with raw keys | ${item.csvFile}`,
      );
      lines.push(`    Name Key rows: ${item.rowsWithNameKey}; Description Key rows: ${item.rowsWithDescriptionKey}`);
      lines.push(`    Required columns fully populated: ${item.fullyPopulatedRequiredColumns}/${item.requiredColumns}`);
      if (item.emptyRequiredColumns.length > 0) {
        lines.push(`    Empty required columns: ${item.emptyRequiredColumns.join(', ')}`);
      }
      if (item.partialRequiredColumns.length > 0) {
        lines.push(
          `    Partially populated required columns: ${item.partialRequiredColumns
            .map((entry) => `${entry.column} ${entry.rows}/${item.rows}`)
            .join(', ')}`,
        );
      }
      lines.push(`    Path: ${item.path}`);
    }
  }
  if (diagnostics.warnings.length > 0) {
    lines.push('Source warnings:');
    for (const warning of diagnostics.warnings) {
      const channel = warning.channel ? ` ${warning.channel}` : '';
      const category = warning.category ? ` ${warning.category}` : '';
      lines.push(`  WARNING ${warning.label}${channel}${category}: ${warning.message}`);
      lines.push(`    Path: ${warning.path}`);
    }
  }
  return lines.join('\n');
}
