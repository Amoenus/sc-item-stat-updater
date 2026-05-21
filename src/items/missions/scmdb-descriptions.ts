/**
 * Mission update config for SCMDB-derived mission descriptions.
 *
 * Handles keys matching `/_desc|_description/i` — strips any existing appended
 * metadata (cooldown, reward lists, notes) and rebuilds them from the CSV row.
 */
import type { ItemConfig } from '../../lib/types';

function formatDescNote(noteText: string): string {
  if (!noteText) {
    return '';
  }
  return String.raw`\n\n${noteText}`;
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
  buildValue(row, _flavorText, oldValue, _targetKey) {
    const description = row['Description'] ?? row['Text'] ?? '';
    const noteText = row['Note'];
    const note = formatDescNote(noteText ?? '');
    const cooldownValue = row['Cooldown'] ?? '';
    const cooldown = cooldownValue ? String.raw`\n\n` + `Cooldown: ${cooldownValue}` : '';
    const rewardListValue = row['RewardList'] ?? '';
    const itemRewardListValue = row['ItemRewardList'] ?? '';
    const noteContainsRewardList =
      typeof noteText === 'string' && rewardListValue !== '' && noteText.includes(rewardListValue);
    const rewardList = rewardListValue && !noteContainsRewardList ? String.raw`\n\n${rewardListValue}` : '';
    const itemRewardList = itemRewardListValue ? String.raw`\n\n[Item Reward]\n\n${itemRewardListValue}` : '';

    if (oldValue) {
      return rebuildDescValue(oldValue, cooldown, note, rewardList, itemRewardList, noteText ?? '');
    }

    return description + cooldown + note + rewardList + itemRewardList;
  },
} satisfies ItemConfig;
