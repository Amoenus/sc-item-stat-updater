import type { ItemConfig, ItemSourceDataContext, ItemSourceFileDeclaration } from '../../enrichment/item-config';
import type { UpdateSourceMetadata, UpdateSourceProvider } from '../use-cases/prepare-update-categories';

export type CategorySourceFileRole = 'primary' | 'lookup' | 'companion';

export interface CategorySourceContractInput {
  config: ItemConfig;
  csvDir: string;
  source?: UpdateSourceMetadata;
  sourceDirs?: ItemSourceDataContext['sourceDirs'];
}

export interface ResolvedCategorySourceFile {
  filename: string;
  baseDir: string;
  provider?: UpdateSourceProvider;
  optional?: boolean;
  role: CategorySourceFileRole;
}

export interface ListedCategorySourceFile {
  filename: string;
  provider?: UpdateSourceProvider;
  optional?: boolean;
  role: CategorySourceFileRole;
}

export function inferCategorySourceProvider(
  config: ItemConfig,
  fallback: UpdateSourceProvider,
): UpdateSourceProvider {
  const requiredSourceDirs = (config.sourceFiles ?? [])
    .filter((sourceFile) => !sourceFile.optional)
    .map((sourceFile) => sourceFile.sourceDir ?? 'csvDir');

  if (requiredSourceDirs.includes('datacore')) return 'datacore';
  if (requiredSourceDirs.includes('scmdb')) return 'scmdb';
  if (requiredSourceDirs.includes('spviewer')) return 'spviewer';

  const primarySource = [config.csvFile, config.jsonFile, config.lookupCsvFile].filter(Boolean).join(' ');
  if (/\.datacore\.|\/datacore\/|\\datacore\\/i.test(primarySource)) return 'datacore';
  if (/\.spviewer\.|\/spviewer\/|\\spviewer\\/i.test(primarySource)) return 'spviewer';
  if (/scmdb/i.test(primarySource)) return 'scmdb';

  return fallback;
}

export function providerFromSourceDir(
  sourceDir: ItemSourceFileDeclaration['sourceDir'],
  csvDirProvider?: UpdateSourceProvider,
): UpdateSourceProvider | undefined {
  if (sourceDir === 'datacore' || sourceDir === 'scmdb' || sourceDir === 'spviewer') return sourceDir;
  if (sourceDir === 'csvDir') return csvDirProvider;
  return undefined;
}

export function resolveCategorySourceFiles(input: CategorySourceContractInput): ResolvedCategorySourceFile[] {
  const listedFiles = listCategorySourceFiles(input.config, input.source?.provider);
  return listedFiles.flatMap((sourceFile) => {
    const baseDir = baseDirForSourceFile(input, sourceFile);
    return baseDir ? [{ ...sourceFile, baseDir }] : [];
  });
}

export function listCategorySourceFiles(
  config: ItemConfig,
  csvDirProvider?: UpdateSourceProvider,
): ListedCategorySourceFile[] {
  const primaryFiles: ListedCategorySourceFile[] = [];
  const usesDeclaredCustomSources = Boolean(config.loadSourceData && config.sourceFiles?.length);
  if (!usesDeclaredCustomSources && config.csvFile) {
    primaryFiles.push({ filename: config.csvFile, role: 'primary', provider: csvDirProvider });
  }
  if (config.jsonFile) {
    primaryFiles.push({ filename: config.jsonFile, role: 'primary', provider: csvDirProvider });
  }
  if (config.lookupCsvFile) {
    primaryFiles.push({ filename: config.lookupCsvFile, role: 'lookup', provider: csvDirProvider });
  }

  const companionFiles = (config.sourceFiles ?? []).map((sourceFile) => {
    const sourceDir = sourceFile.sourceDir ?? 'csvDir';
    return {
      filename: sourceFile.file,
      provider: providerFromSourceDir(sourceDir, csvDirProvider),
      optional: sourceFile.optional,
      role: 'companion' as const,
    };
  });

  return [...primaryFiles, ...companionFiles];
}

export function categorySourceHint(config: ItemConfig, csvDirProvider?: UpdateSourceProvider): string | undefined {
  if (config.resolveJsonFile) {
    return 'dynamic JSON source resolved from the selected source directory';
  }
  if (listCategorySourceFiles(config, csvDirProvider).length === 0) {
    return 'source file is resolved by category logic';
  }
  return undefined;
}

function baseDirForSourceFile(
  input: CategorySourceContractInput,
  sourceFile: ListedCategorySourceFile,
): string | undefined {
  if (sourceFile.role === 'primary' || sourceFile.role === 'lookup') return input.csvDir;

  const declaration = (input.config.sourceFiles ?? []).find((candidate) => candidate.file === sourceFile.filename);
  const sourceDir = declaration?.sourceDir ?? 'csvDir';
  return sourceDir === 'csvDir' ? input.csvDir : input.sourceDirs?.[sourceDir];
}
