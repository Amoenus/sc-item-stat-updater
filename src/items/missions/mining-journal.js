// @ts-check
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Finds the mining-journal.csv file in the given SCMDB version directory.
 * 
 * @param {string} csvDir - the versioned SCMDB directory (e.g. csv/scmdb/4.1.1-live.9800000)
 * @returns {Promise<string>} resolved absolute path to the csv file
 */
async function resolveCsvFile(csvDir) {
  const csvPath = path.join(csvDir, 'mining-journal.csv');
  
  try {
    await fs.access(csvPath);
    return csvPath;
  } catch {
    throw new Error(`Mining journal: CSV file not found: ${csvPath}. Run scrape-scmdb.js first.`);
  }
}

/**
 * Builds the journal value from CSV rows.
 * 
 * @param {Array<Record<string, string>>} rows - CSV rows from mining-journal.csv
 * @param {string} oldValue - current INI value for Journal_General_Mining_Compendium_Content
 * @returns {string} new INI value with rarity-grouped format
 */
export function buildJournalValue(rows, oldValue) {
  // Extract intro block - everything before first "\n\n**" (start of first rarity section)
  const introEndIndex = oldValue.indexOf('\n\n**');
  const introBlock = introEndIndex !== -1 ? oldValue.substring(0, introEndIndex) : oldValue;
  
  // Define rarity order (skip Unknown)
  const rarityOrder = ['Legendary', 'Epic', 'Rare', 'Uncommon', 'Common'];
  
  // Group elements by rarity category
  const rarityGroups = {};
  for (const row of rows) {
    const rarityCategory = row['Rarity Category'];
    const elementList = row['Element List'];
    
    if (rarityCategory && elementList && rarityCategory !== 'Unknown') {
      // Split element list by newline and trim each element
      const elements = elementList
        .split('\n')
        .map(elem => elem.trim())
        .filter(elem => elem.length > 0);
      
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
      // Add section separator (double newline) if not the first section after intro
      if (result.length > introBlock.length) {
        result += '\n\n';
      }
      result += `** ${rarity} **\n${elements.join('\n')}`;
    }
  }
  
  return result;
}

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'mining-journal.csv',
  label: 'Mining journal',
  requiredColumns: ['Rarity Category', 'Element List'],
  // This config uses a custom buildJournalValue function instead of standard ItemConfig methods
  // The update-all.js will need to call this function directly
};