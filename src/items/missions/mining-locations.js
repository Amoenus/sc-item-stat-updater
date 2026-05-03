// @ts-check
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Finds the mining-locations.csv file in the given SCMDB version directory.
 * 
 * @param {string} csvDir - the versioned SCMDB directory (e.g. csv/scmdb/4.1.1-live.9800000)
 * @returns {Promise<string>} resolved absolute path to the csv file
 */
async function resolveCsvFile(csvDir) {
  const csvPath = path.join(csvDir, 'mining-locations.csv');
  
  try {
    await fs.access(csvPath);
    return csvPath;
  } catch {
    throw new Error(`Mining locations: CSV file not found: ${csvPath}. Run scrape-scmdb.js first.`);
  }
}

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'mining-locations.csv',
  label: 'Mining locations',
  requiredColumns: ['Location Name', 'Ship Mineables', 'Hand Mineables'],
  
  /**
   * Derives the target INI key from the Location Name.
   * Uses a static location key map that should be maintained separately.
   * For now, we return an empty array and will handle unmapped rows via logging.
   * In practice, this map would be populated from inspection of global.ini.
   * 
   * @param {{'Location Name': string}} row - CSV row data
   * @param {(nameKey: string) => string} deriveDescKey - helper to create desc key from name (not used here)
   * @returns {string[]} array with the target key if found in the map, otherwise empty
   */
  getTargetKeys(row, deriveDescKey) {
    // The location key map should be maintained externally.
    // For the MVP, we'll skip rows that aren't in the map.
    // In a production system, this map would be generated from global.ini analysis.
    return []; // To be implemented with actual mapping
  },
  
  /**
   * Builds the new INI value for a location description.
   * 
   * @param {{'Location Name': string, 'Ship Mineables': string, 'Hand Mineables': string}} row
   * @param {string} flavorText - existing flavor text from INI (everything before first "Potential " section)
   * @param {string} oldValue - current INI value
   * @param {string} targetKey - the INI key being updated
   * @returns {string} new INI value with updated mineable sections
   */
  buildValue(row, flavorText, oldValue, targetKey) {
    // If we don't have a target key (not in our map), skip the update
    if (!targetKey) {
      return oldValue;
    }
    
    // Extract flavor text: everything before the first "Potential " section heading
    const potentialIndex = oldValue.indexOf('\n\nPotential ');
    let cleanFlavorText = oldValue;
    if (potentialIndex !== -1) {
      cleanFlavorText = oldValue.substring(0, potentialIndex);
    }
    
    // Parse existing "Potential X:" sections into a dict
    const sections = {};
    const potentialRegex = /\n\nPotential ([^\n]+):\n([\s\S]*?)(?=\n\nPotential |\n\n$)/g;
    let match;
    while ((match = potentialRegex.exec(oldValue)) !== null) {
      const sectionName = match[1]; // e.g., "Ship Mineables"
      const sectionContent = match[2].trim();
      sections[sectionName] = sectionContent;
    }
    
    // Get CSV values
    const shipMineables = row['Ship Mineables'] || '';
    const handMineables = row['Hand Mineables'] || '';
    
    // Update sections
    if (shipMineables.trim() !== '') {
      // Convert newline-separated list to proper format (each item on new line)
      const shipList = shipMineables
        .split('\n')
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .join('\n');
      sections['Ship Mineables'] = shipList;
    } else {
      // Remove section if empty in CSV
      delete sections['Ship Mineables'];
    }
    
    if (handMineables.trim() !== '') {
      const handList = handMineables
        .split('\n')
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .join('\n');
      sections['Hand Mineables'] = handList;
    } else {
      delete sections['Hand Mineables'];
    }
    
    // Note: We do not modify Ground Vehicle Mineables, Harvestables, Creatures
    
    // Define canonical section order
    const sectionOrder = [
      'Ship Mineables',
      'Ground Vehicle Mineables',
      'Hand Mineables',
      'Harvestables',
      'Creatures'
    ];
    
    // Re-assemble
    let result = cleanFlavorText;
    
    for (const sectionName of sectionOrder) {
      if (sections[sectionName] !== undefined) {
        const content = sections[sectionName];
        if (content.trim() !== '') {
          // Add section separator if not the first section
          if (result.length > cleanFlavorText.length) {
            result += '\n\n';
          }
          result += `Potential ${sectionName}:\n${content}`;
        }
      }
    }
    
    return result;
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