/**
 * Mission update config for SCMDB-derived mission descriptions.
 *
 * The CSV should include a localization key and the mission text to write
 * into `global.ini`. This module allows mission updates to be processed
 * through the existing updater engine.
 */
import { IniTag } from '../../lib/ini-tags';
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

function rebuildTitleValue(oldValue: string, noteText: string | undefined, note: string): string {
  const normalizedOldValue = oldValue.replace(
    new RegExp(String.raw`\s*(?:${IniTag.EM4.open}\[BP(?: Chain)?\]${IniTag.EM4.close}|\[BP(?: Chain)?\])\s*$`),
    '',
  );
  return noteText ? `${normalizedOldValue}${note}` : normalizedOldValue;
}

function rebuildDescValue(
  oldValue: string,
  cooldown: string,
  note: string,
  rewardList: string,
  itemRewardList: string,
  noteText: string,
): string {
  const normalized = oldValue.replace(
    /(?:\\n\\n(?:Cooldown: [^\\]+|\[BP Reward\]|\[BP Chain\]|\[Item Reward\]))(?:\\n\\n.*)?$/,
    '',
  );
  if (!noteText && !rewardList && !itemRewardList && !cooldown) return normalized;
  return `${normalized}${cooldown}${note}${rewardList}${itemRewardList}`;
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
    const cooldownValue = row['Cooldown'] ?? '';
    const cooldown = !isTitle && cooldownValue ? String.raw`\n\n` + `Cooldown: ${cooldownValue}` : '';
    const rewardListValue = !isTitle && row['RewardList'] ? row['RewardList'] : '';
    const itemRewardListValue = !isTitle && row['ItemRewardList'] ? row['ItemRewardList'] : '';
    const noteContainsRewardList =
      !isTitle && typeof noteText === 'string' && rewardListValue && noteText.includes(rewardListValue);
    const rewardList = rewardListValue && !noteContainsRewardList ? String.raw`\n\n${rewardListValue}` : '';
    const itemRewardList = itemRewardListValue
      ? String.raw`\n\n[Item Reward]\n\n${itemRewardListValue}`
      : '';

    if (oldValue) {
      if (isTitle) {
        return rebuildTitleValue(oldValue, noteText, note);
      }

      return rebuildDescValue(oldValue, cooldown, note, rewardList, itemRewardList, noteText ?? '');
    }

    return description + cooldown + note + rewardList + itemRewardList;
  },
} satisfies ItemConfig;
