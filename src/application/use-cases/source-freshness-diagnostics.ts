import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import type {
  PreparedUpdateCategories,
  UpdateCategory,
  UpdateChannel,
  UpdateProvider,
  UpdateSourceProvider,
} from './prepare-update-categories';
import type { ItemSourceFileDeclaration } from '../../enrichment/item-config';
import { DATACORE_RAW_FACTS, type RawFactListingEntry } from './category-listing';

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

export interface SourceFreshnessDiagnostics {
  versions: SourceVersionDiagnostic[];
  warnings: SourceFreshnessWarning[];
}

function providerLabel(provider: UpdateSourceProvider): string {
  switch (provider) {
    case 'datacore':
      return 'DataCore';
    case 'scmdb':
      return 'SCMDB';
    case 'spviewer':
      return 'SPViewer';
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
  return 'spviewer';
}

function providerFromSourceDir(sourceDir: ItemSourceFileDeclaration['sourceDir']): UpdateSourceProvider | undefined {
  if (sourceDir === 'datacore' || sourceDir === 'scmdb' || sourceDir === 'spviewer') return sourceDir;
  return undefined;
}

function resolveDeclaredSourceFiles(
  category: UpdateCategory,
): Array<{ filename: string; baseDir: string; provider?: UpdateSourceProvider }> {
  const staticFiles = [category.config.csvFile, category.config.jsonFile, category.config.lookupCsvFile]
    .filter((filename): filename is string => typeof filename === 'string')
    .map((filename) => ({ filename, baseDir: category.csvDir, provider: category.source?.provider }));

  const companionFiles = (category.config.sourceFiles ?? []).flatMap((sourceFile) => {
    const sourceDir = sourceFile.sourceDir ?? 'csvDir';
    const baseDir = sourceDir === 'csvDir' ? category.csvDir : category.sourceDirs?.[sourceDir];
    if (!baseDir) return [];
    return [{ filename: sourceFile.file, baseDir, provider: providerFromSourceDir(sourceDir) }];
  });

  return [...staticFiles, ...companionFiles];
}

async function collectIncompleteSourceWarnings(category: UpdateCategory): Promise<SourceFreshnessWarning[]> {
  const sourceFiles = resolveDeclaredSourceFiles(category);
  const warnings = await Promise.all(
    sourceFiles.map(async ({ filename, baseDir, provider: fileProvider }) => {
      const sourcePath = resolveChildPath(baseDir, filename, 'source file');
      try {
        await fs.access(sourcePath);
        return null;
      } catch {
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
        await fs.access(sourcePath);
        return null;
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
  const incompleteWarnings = dedupeWarningsByPath([...categoryWarnings, ...rawFactWarnings]);
  return { versions, warnings: [...staleWarnings, ...incompleteWarnings] };
}

export function formatSourceFreshnessDiagnostics(diagnostics: SourceFreshnessDiagnostics): string {
  const lines = ['Source data:'];
  for (const source of diagnostics.versions) {
    lines.push(`  ${source.label} (${source.channel}): ${source.version}`);
    lines.push(`    Path: ${source.path}`);
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
