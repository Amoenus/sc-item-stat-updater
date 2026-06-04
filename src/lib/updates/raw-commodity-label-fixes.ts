import { findIniKey, readIniFile, writeIniFileIfChanged } from '../../localization/ini-file';
import { getLogger } from '../logger';
import { buildScannedUpdateResult } from './update-result';

const logger = getLogger('raw-commodity-label-fixes-update');

const RAW_COMMODITY_LABEL_FIXES = {
  items_commodities_raw_ice: 'Ice (Raw)',
  items_commodities_raw_ouratite: 'Ouratite (Raw)',
  items_commodities_raw_silicon: 'Silicon (Raw)',
  items_commodities_hephaestanite_raw: 'Heph (Raw)',
};

/**
 * @param {object} params
 * @param {string} params.iniPath
 * @param {boolean} params.dryRun
 * @returns {Promise<{label: string, updatedCount: number, matchedCount: number, scannedCount: number, issues: Array<{key: string, reason: string, type: string}>, summary: string}>}
 */
export async function runRawCommodityLabelFixUpdate({ iniPath, dryRun }: { iniPath: string; dryRun: boolean }) {
  const start = performance.now();
  const iniData = await readIniFile(iniPath);
  const { lines, index, lowerCaseIndex } = iniData;

  const issues: Array<{ key: string; reason: string; type: string }> = [];
  let matchedCount = 0;
  let updatedCount = 0;
  const scannedCount = Object.keys(RAW_COMMODITY_LABEL_FIXES).length;

  for (const [targetKey, targetValue] of Object.entries(RAW_COMMODITY_LABEL_FIXES)) {
    const matchKey = findIniKey(index, lowerCaseIndex, targetKey);
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

    const lineKey = eqIdx > -1 ? currentLine.substring(0, eqIdx) : matchKey;
    lines[lineIndex] = `${lineKey}=${targetValue}`;
    updatedCount++;
  }

  await writeIniFileIfChanged(iniPath, lines, { dryRun, updatedCount, skipBackup: true });

  const durationMs = Math.round(performance.now() - start);
  logger.info('Raw commodity label fix update complete', {
    updatedCount,
    matchedCount,
    scannedCount,
    issueCount: issues.length,
    dryRun,
    durationMs,
  });

  return buildScannedUpdateResult({
    label: 'Raw commodity labels',
    updatedCount,
    matchedCount,
    scannedCount,
    issues,
    dryRun,
    durationMs,
  });
}
