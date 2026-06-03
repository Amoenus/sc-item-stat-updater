import path from 'node:path';

/** Resolves a child path under a base directory with traversal protection. */
export function resolveChildPath(baseDir: string, childPath: string, label = 'Path'): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(resolvedBase, childPath);

  if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
    throw new Error(`Path traversal detected in ${label}: ${childPath}`);
  }

  return resolvedPath;
}

/** Resolves a CSV file path under a SPViewer version directory. */
export function resolveSpviewerCsvPath(spviewerDir: string, csvFilename: string): string {
  return resolveChildPath(spviewerDir, csvFilename, 'SPViewer CSV filename');
}

/** Resolves a CSV file path under a mission/SCMDB version directory. */
export function resolveMissionCsvPath(missionCsvDir: string, csvFilename: string): string {
  return resolveChildPath(missionCsvDir, csvFilename, 'Mission CSV filename');
}

/** Resolves a mapping JSON path under repoRoot/mappings. */
export function resolveMappingJsonPath(repoRoot: string, mappingFilename: string): string {
  const mappingsDir = path.resolve(repoRoot, 'mappings');
  return resolveChildPath(mappingsDir, mappingFilename, 'Mapping JSON filename');
}
