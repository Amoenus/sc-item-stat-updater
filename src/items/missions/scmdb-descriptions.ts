/**
 * Mission update config for SCMDB-derived mission descriptions.
 *
 * Handles keys matching `/_desc|_description/i` — strips any existing appended
 * metadata (cooldown, reward lists, notes) and rebuilds them from the CSV row.
 */
import type { ItemConfig } from '../../lib/types';

const APPENDED_METADATA_PATTERN =
  /(?:\\n\\n(?:Cooldown: [^\\]+|\[BP Reward\]|\[BP Chain\]|\[Item Reward\]))(?:\\n\\n.*)?$/;

function appendParagraph(value: string): string {
  return value ? String.raw`\n\n${value}` : '';
}

function formatCooldown(cooldown: string): string {
  return cooldown ? String.raw`\n\nCooldown: ${cooldown}` : '';
}

function formatRewardList(rewardList: string, noteText: string): string {
  const noteAlreadyContainsRewardList = noteText.includes(rewardList);
  return rewardList && !noteAlreadyContainsRewardList ? appendParagraph(rewardList) : '';
}

function formatItemRewardList(itemRewardList: string): string {
  return itemRewardList ? String.raw`\n\n[Item Reward]\n\n${itemRewardList}` : '';
}

function getCell(row: Record<string, string>, column: string): string {
  return row[column] ?? '';
}

function buildMetadata(row: Record<string, string>): string {
  const noteText = getCell(row, 'Note');

  return [
    formatCooldown(getCell(row, 'Cooldown')),
    appendParagraph(noteText),
    formatRewardList(getCell(row, 'RewardList'), noteText),
    formatItemRewardList(getCell(row, 'ItemRewardList')),
  ].join('');
}

function stripAppendedMetadata(oldValue: string): string {
  return oldValue.replace(APPENDED_METADATA_PATTERN, '');
}

export default {
  label: 'SCMDB mission descriptions',
  csvFile: 'missions/scmdb-missions.csv',
  requiredColumns: ['Localization Key', 'Description'],
  noInsert: true,
  descKeyMatch: (key) => /_desc|_description/i.test(key),
  buildValue(row, _flavorText, oldValue, _targetKey) {
    const description = row['Description'] ?? row['Text'] ?? '';
    const baseValue = oldValue ? stripAppendedMetadata(oldValue) : description;

    return `${baseValue}${buildMetadata(row)}`;
  },
} satisfies ItemConfig;
