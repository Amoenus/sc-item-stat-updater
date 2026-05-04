// @ts-check

import path from 'node:path';

/**
 * Resolves a child path under a base directory with traversal protection.
 *
 * @param {string} baseDir
 * @param {string} childPath
 * @param {string} label
 * @returns {string}
 */
export function resolveChildPath(baseDir, childPath, label = 'Path') {
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(resolvedBase, childPath);

  if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
    throw new Error(`Path traversal detected in ${label}: ${childPath}`);
  }

  return resolvedPath;
}

/**
 * Resolves a CSV file path under a SPViewer version directory.
 *
 * @param {string} spviewerDir
 * @param {string} csvFilename
 * @returns {string}
 */
export function resolveSpviewerCsvPath(spviewerDir, csvFilename) {
  return resolveChildPath(spviewerDir, csvFilename, 'SPViewer CSV filename');
}

/**
 * Resolves a CSV file path under a mission/SCMDB version directory.
 *
 * @param {string} missionCsvDir
 * @param {string} csvFilename
 * @returns {string}
 */
export function resolveMissionCsvPath(missionCsvDir, csvFilename) {
  return resolveChildPath(missionCsvDir, csvFilename, 'Mission CSV filename');
}

/**
 * Resolves a mapping JSON path under repoRoot/mappings.
 *
 * @param {string} repoRoot
 * @param {string} mappingFilename
 * @returns {string}
 */
export function resolveMappingJsonPath(repoRoot, mappingFilename) {
  const mappingsDir = path.resolve(repoRoot, 'mappings');
  return resolveChildPath(mappingsDir, mappingFilename, 'Mapping JSON filename');
}
