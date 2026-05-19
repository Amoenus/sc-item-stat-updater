/**
 * Mission update config for SCMDB-derived mission descriptions.
 *
 * The CSV should include a localization key and the mission text to write
 * into `global.ini`. This module allows mission updates to be processed
 * through the existing updater engine.
 */
import type { ItemConfig } from '../../lib/types';

function formatMissionNote(noteText: string, isTitle: boolean): string {
  if (!noteText) {
    return '';
  }

  if (!isTitle) {
    return String.raw`\n\n${noteText}`;
  }

  return /^\s/.test(noteText) ? noteText : ` ${noteText}`;
}

export default {
  label: 'SCMDB mission descriptions',
  csvFile: 'missions/scmdb-missions.csv',
  requiredColumns: ['Localization Key', 'Description'],
  noInsert: true,
  descKeyMatch: (key) => /_desc|_description/i.test(key),
  buildValue(row, _flavorText, oldValue, targetKey) {
    const description = row['Description'] ?? row['Text'] ?? '';
    const isTitle = /_title/i.test(targetKey);
    const noteText = isTitle ? row['TitleNote'] : row['Note'];
    const note = formatMissionNote(noteText, isTitle);
    const rewardListValue = !isTitle && row['RewardList'] ? row['RewardList'] : '';
    const noteContainsRewardList =
      !isTitle && typeof noteText === 'string' && rewardListValue && noteText.includes(rewardListValue);
    const rewardList = rewardListValue && !noteContainsRewardList ? String.raw`\n\n${rewardListValue}` : '';

    if (oldValue) {
      if (isTitle) {
        const normalizedOldValue = oldValue.replace(/\s*(?:<EM4>\[BP(?: Chain)?\]<\/EM4>|\[BP(?: Chain)?\])\s*$/, '');
        if (!noteText) {
          return normalizedOldValue;
        }
        return `${normalizedOldValue}${note}`;
      }

      const normalizedOldValue = oldValue.replace(/(?:\\n\\n(?:\[BP Reward\]|\[BP Chain\]))(?:\\n\\n.*)?$/, '');
      if (!noteText && !rewardList) {
        return normalizedOldValue;
      }
      return `${normalizedOldValue}${note}${rewardList}`;
    }

    return description + note + rewardList;
  },
} satisfies ItemConfig;
