import { readIniFile, writeIniFile } from '../io/ini-file.js';
import { getLogger } from '../logger.js';

const logger = getLogger('raw-commodity-label-fixes-update');

const RAW_COMMODITY_LABEL_FIXES = {
  'items_commodities_raw_ice,p': 'Ice (Raw)',
  items_commodities_raw_ouratite: 'Ouratite (Raw)',
  'items_commodities_raw_silicon,p': 'Silicon (Raw)',
};

/**
 * @param {object} params
 * @param {string} params.iniPath
 * @param {boolean} params.dryRun
 * @returns {Promise<{label: string, updatedCount: number, matchedCount: number, scannedCount: number, issues: Array<{key: string, reason: string, type: string}>, summary: string}>}
 */
export async function runRawCommodityLabelFixUpdate({ iniPath, dryRun }) {
  const start = performance.now();
  const { lines, index } = await readIniFile(iniPath);
  const indexKeys = Object.keys(index);

  const issues = [];
  let matchedCount = 0;
  let updatedCount = 0;
  const scannedCount = Object.keys(RAW_COMMODITY_LABEL_FIXES).length;

  for (const [targetKey, targetValue] of Object.entries(RAW_COMMODITY_LABEL_FIXES)) {
    const matchKey = indexKeys.find((key) => key.toLowerCase() === targetKey.toLowerCase());
    if (matchKey === undefined) {
      issues.push({ key: targetKey, reason: 'Localization key not found', type: 'unresolved' });
      continue;
    }

    matchedCount++;
    const lineIndex = index[matchKey];
    const currentLine = lines[lineIndex];
    const eqIdx = currentLine.indexOf('=');
    const currentValue = eqIdx > -1 ? currentLine.substring(eqIdx + 1) : '';

    if (currentValue === targetValue) {
      continue;
    }

    lines[lineIndex] = `${matchKey}=${targetValue}`;
    updatedCount++;
  }

  if (!dryRun && updatedCount > 0) {
    await writeIniFile(iniPath, lines, { skipBackup: true });
  }

  const durationMs = Math.round(performance.now() - start);
  logger.info('Raw commodity label fix update complete', {
    updatedCount,
    matchedCount,
    scannedCount,
    issueCount: issues.length,
    dryRun,
    durationMs,
  });

  return {
    label: 'Raw commodity labels',
    updatedCount,
    matchedCount,
    scannedCount,
    issues,
    summary: `Raw commodity labels: Updated ${updatedCount}, Matched ${matchedCount}, Scanned ${scannedCount}${dryRun ? ' (dry run)' : ''} [${durationMs}ms]`,
  };
}
