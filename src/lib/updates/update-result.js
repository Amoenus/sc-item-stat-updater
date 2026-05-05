/**
 * Builds a standardized update result payload used by special updater modules.
 *
 * @param {object} params
 * @param {string} params.label
 * @param {number} params.updatedCount
 * @param {number} params.matchedCount
 * @param {number} params.scannedCount
 * @param {boolean} params.dryRun
 * @param {number} params.durationMs
 * @param {Array<unknown>} [params.issues]
 * @returns {{
 *   label: string,
 *   updatedCount: number,
 *   matchedCount: number,
 *   scannedCount: number,
 *   issues: Array<unknown>,
 *   summary: string,
 * }}
 */
export function buildScannedUpdateResult({
  label,
  updatedCount,
  matchedCount,
  scannedCount,
  dryRun,
  durationMs,
  issues = [],
}) {
  const dryRunSuffix = dryRun ? ' (dry run)' : '';
  return {
    label,
    updatedCount,
    matchedCount,
    scannedCount,
    issues,
    summary: `${label}: Updated ${updatedCount}, Matched ${matchedCount}, Scanned ${scannedCount}${dryRunSuffix} [${durationMs}ms]`,
  };
}
