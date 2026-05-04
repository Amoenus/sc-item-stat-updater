// @ts-check
export default {
  csvFile: 'mining-elements.csv',
  label: 'Mining element stats',
  requiredColumns: ['Element Name', 'Rarity', 'Scan Signature', 'Resistance', 'Instability'],
  // Only update keys already in the INI; never insert orphan commodity entries
  noInsert: true,
  // Only match _ore_desc and _raw_desc keys — those carry flavor text and scanner data
  descKeyMatch: (/** @type {string} */ kl) => kl.startsWith('items_commodities_') && (kl.endsWith('_ore_desc') || kl.endsWith('_raw_desc')),

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

    // Match suffix: "Agricium (Ore)" -> base="Agricium", type="ore"
    //               "Aphorite (Raw)" -> base="Aphorite",  type="raw"
    const suffixMatch = elementName.match(/^(.+?)\s*\((\w+)\)\s*$/);

    if (suffixMatch) {
      const baseName = suffixMatch[1];
      const suffix = suffixMatch[2].toLowerCase(); // "ore" or "raw"
      const keyBase = baseName.toLowerCase().replace(/[\s-]/g, '');
      // e.g. "items_commodities_agricium_ore_desc"
      return [`items_commodities_${keyBase}_${suffix}_desc`];
    }

    // No suffix in CSV name — try both _raw_desc and _ore_desc; the updater
    // (noInsert: true) will keep only the variant that already exists in the INI.
    const keyBase = elementName.toLowerCase().replace(/[\s-]/g, '');
    return [
      `items_commodities_${keyBase}_raw_desc`,
      `items_commodities_${keyBase}_ore_desc`,
    ];
  },

  /**
   * Builds the new INI value by appending scanner data stats.
   *
  * @param {{'Element Name': string, 'Rarity': string, 'Scan Signature': string, 'Resistance': string, 'Instability': string, 'Ground Scan Signature'?: string}} row
   * @param {string} flavorText - existing flavor text from INI
   * @param {string} oldValue - current INI value
   * @param {string} targetKey - the INI key being updated
   * @returns {string} new INI value with appended stats
   */
  buildValue(row, flavorText, oldValue, targetKey) {
    // Use the full existing INI value as the base — for _ore_desc/_raw_desc keys the entire
    // value is flavor text (no \n\n separator before a stats block like other items use).
    // Strip any previously-appended scanner block first for idempotency.
    const statsBlockMarker = '\\n\\n** Scanner Data **';
    const statsBlockIndex = oldValue.indexOf(statsBlockMarker);
    let cleanFlavorText = statsBlockIndex !== -1 ? oldValue.substring(0, statsBlockIndex) : oldValue;

    // Build the stats block
    const rarity = row['Rarity'] || 'N/A';
    const scanSignature = row['Scan Signature'] || 'N/A';
    const resistance = row['Resistance'] || 'N/A';
    const instability = row['Instability'] || 'N/A';

    // Capitalize rarity (Title Case)
    const formattedRarity = rarity === 'N/A' ? 'N/A' :
      rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase();

    let statsBlock = `\\n\\n** Scanner Data **\\nRarity: ${formattedRarity}\\nScan Signature: ${scanSignature}\\nResistance: ${resistance}\\nInstability: ${instability}`;

    // Add Ground Scan Signature if present
    const groundScanSignature = row['Ground Scan Signature'];
    if (groundScanSignature && groundScanSignature.trim() !== '') {
      statsBlock = statsBlock.replace(
        /(Scan Signature: [^\\]*)/,
        `$1\\nGround Scan Signature: ${groundScanSignature}`
      );
    }

    return cleanFlavorText + statsBlock;
  },
};
