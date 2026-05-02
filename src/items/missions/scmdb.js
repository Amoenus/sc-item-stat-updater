/**
 * Mission update config for SCMDB-derived mission descriptions.
 *
 * The CSV should include a localization key and the mission text to write
 * into `global.ini`. This module allows mission updates to be processed
 * through the existing updater engine.
 */
export default {
  label: 'SCMDB mission descriptions',
  csvFile: 'missions/scmdb-missions.csv',
  requiredColumns: ['Localization Key', 'Description'],
  descKeyMatch: (key) => /_desc|_description/i.test(key),
  buildValue(row, flavorText, oldValue, targetKey) {
    const description = row['Description'] ?? row['Text'] ?? '';
    const isTitle = /_title/i.test(targetKey);
    const noteText = isTitle ? row['TitleNote'] : row['Note'];
    let note = '';
    if (noteText) {
      note = isTitle ? noteText : String.raw`\n\n${noteText}`;
    }
    const rewardList = !isTitle && row['RewardList'] ? String.raw`\n\n${row['RewardList']}` : '';

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
};
