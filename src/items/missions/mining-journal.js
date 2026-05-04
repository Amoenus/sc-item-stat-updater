// @ts-check
/**
 * Builds the journal value from CSV rows.
 *
 * @param {Array<Record<string, string>>} rows - CSV rows from mining-journal.csv
 * @param {string} oldValue - current INI value for Journal_General_Mining_Compendium_Content
 * @returns {string} new INI value with rarity-grouped format
 */
export function buildJournalValue(rows, oldValue) {
  // Extract intro block - everything before first "\\n\\n**" (start of first rarity section)
  const introEndIndex = oldValue.indexOf('\\n\\n**');
  const introBlock = introEndIndex !== -1 ? oldValue.substring(0, introEndIndex) : oldValue;

  // Define rarity order (skip Unknown)
  const rarityOrder = ['Legendary', 'Epic', 'Rare', 'Uncommon', 'Common'];

  // Group elements by rarity category
  /** @type {Record<string, string[]>} */
  const rarityGroups = {};
  for (const row of rows) {
    const rarityCategory = row['Rarity Category'];
    const elementList = row['Element List'];

    if (rarityCategory && elementList && rarityCategory !== 'Unknown') {
      // Split element list by actual newlines from CSV, then trim
      const elements = elementList
        .split(/\r?\n/)
        .map((elem) => elem.trim())
        .filter((elem) => elem.length > 0);

      if (elements.length > 0) {
        rarityGroups[rarityCategory] = elements;
      }
    }
  }

  // Build sections in correct order
  let result = introBlock;

  // Add each rarity section if it has elements
  for (const rarity of rarityOrder) {
    const elements = rarityGroups[rarity];
    if (elements && elements.length > 0) {
      result += `\\n\\n** ${rarity} **\\n${elements.join('\\n')}`;
    }
  }

  return result;
}

export default {
  csvFile: 'mining-journal.csv',
  label: 'Mining journal',
  requiredColumns: ['Rarity Category', 'Element List'],
  // Handled explicitly in update-all.js via buildJournalValue; skip the standard runUpdate loop
  skip: true,
  descKeyMatch: (/** @type {string} */ kl) => kl.startsWith('journal_general_mining'),
};
