// @ts-check
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Finds the mining-elements.csv file in the given SCMDB version directory.
 * 
 * @param {string} csvDir - the versioned SCMDB directory (e.g. csv/scmdb/4.1.1-live.9800000)
 * @returns {Promise<string>} resolved absolute path to the csv file
 */
async function resolveCsvFile(csvDir) {
  const csvPath = path.join(csvDir, 'mining-elements.csv');
  
  try {
    await fs.access(csvPath);
    return csvPath;
  } catch {
    throw new Error(`Mining elements: CSV file not found: ${csvPath}. Run scrape-scmdb.js first.`);
  }
}

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'mining-elements.csv',
  label: 'Mining element stats',
  requiredColumns: ['Element Name', 'Rarity', 'Scan Signature', 'Resistance', 'Instability'],
  descKeyMatch: (kl) => kl.startsWith('items_commodities_') && kl.endsWith('_desc'),
  
  /**
   * Derives the target INI key from the Element Name.
   * 
   * @param {{'Element Name': string}} row - CSV row data
   * @param {(nameKey: string) => string} deriveDescKey - helper to create desc key from name
   * @returns {string[]} array with the target key if found in INI, otherwise empty
   */
  getTargetKeys(row, deriveDescKey) {
    const elementName = row['Element Name'];
    if (!elementName) return [];
    
    // Strip suffix in parens: "Agricium (Ore)" -> "Agricium"
    const baseName = elementName.replace(/\s*\([^)]*\)$/g, '');
    // Lowercase, remove spaces/hyphens: "Agricium" -> "agricium"
    const keyBase = baseName.toLowerCase().replace(/[\s-]/g, '');
    // Emit key: "items_commodities_agricium_desc"
    const targetKey = `items_commodities_${keyBase}_desc`;
    
    // Return the key only if it matches our descKeyMatch (basic validation)
    // The actual existence check happens in the updater engine
    return [targetKey];
  },
  
  /**
   * Builds the new INI value by appending scanner data stats.
   * 
   * @param {{'Element Name': string, 'Rarity': string, 'Scan Signature': string, 'Resistance': string, 'Instability': string}} row
   * @param {string} flavorText - existing flavor text from INI
   * @param {string} oldValue - current INI value
   * @param {string} targetKey - the INI key being updated
   * @returns {string} new INI value with appended stats
   */
  buildValue(row, flavorText, oldValue, targetKey) {
    // Start with existing flavor text (strip any existing stats block first for idempotency)
    let cleanFlavorText = flavorText;
    const statsBlockMarker = '\n\n** Scanner Data **';
    const statsBlockIndex = cleanFlavorText.indexOf(statsBlockMarker);
    if (statsBlockIndex !== -1) {
      cleanFlavorText = cleanFlavorText.substring(0, statsBlockIndex);
    }
    
    // Build the stats block
    const rarity = row['Rarity'] || 'N/A';
    const scanSignature = row['Scan Signature'] || 'N/A';
    const resistance = row['Resistance'] || 'N/A';
    const instability = row['Instability'] || 'N/A';
    
    // Capitalize rarity (Title Case)
    const formattedRarity = rarity === 'N/A' ? 'N/A' : 
      rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase();
    
    let statsBlock = `\n\n** Scanner Data **\nRarity: ${formattedRarity}\nScan Signature: ${scanSignature}\nResistance: ${resistance}\nInstability: ${instability}`;
    
    // Add Ground Scan Signature if present
    const groundScanSignature = row['Ground Scan Signature'];
    if (groundScanSignature && groundScanSignature.trim() !== '') {
      statsBlock = statsBlock.replace(
        /(Scan Signature: [^\n]*)/, 
        `$1\nGround Scan Signature: ${groundScanSignature}`
      );
    }
    
    return cleanFlavorText + statsBlock;
  },
  
  /**
   * Resolves the CSV file path dynamically.
   * 
   * @param {string} csvDir - the versioned SCMDB directory
   * @returns {Promise<string>} resolved absolute path to the csv file
   */
  async resolveCsvFile(csvDir) {
    return resolveCsvFile(csvDir);
  }
};