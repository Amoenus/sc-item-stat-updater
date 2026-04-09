import { fmtNum } from '../lib/formatter.js';

export default {
  csvFile: 'mining_lasers.csv',
  label: 'Mining Lasers',
  descKeyMatch: (kl) => kl.includes('mininglaser') && kl.includes('_desc'),
  nameKeyToDescKey(nameKey) {
    if (nameKey.startsWith('item_Mining_')) {
      return nameKey + '_Desc';
    }
    return nameKey.replace(/(item_)(Name|name|NAME)/, (m, prefix, word) => {
      if (word === 'name') return prefix + 'desc';
      if (word === 'NAME') return prefix + 'DESC';
      return prefix + 'Desc';
    });
  },
  buildValue(r, flavorText) {
    let val = `Item Type: Mining Laser` +
      `\\nManufacturer: ${r['Manufacturer']}` +
      `\\nSize: ${r['Size']}` +
      `\\n\\n-- Mining Stats --` +
      `\\nOutput Power: ${fmtNum(r['Output Pwr/s'])}` +
      `\\nGadget Slots: ${r['Gadget Slots']}` +
      `\\nFull Dmg Range: ${r['Full Dmg Range']}m` +
      `\\nZero Dmg Range: ${r['Zero Dmg Range']}m` +
      `\\nThrottle Lerp Speed: ${r['Throttle Lerp Speed']}` +
      `\\n\\n-- Modifiers --` +
      `\\nResistance: ${r['Resistance']}` +
      `\\nLaser Instability: ${r['Laser Instability']}` +
      `\\nOptimal Charge Size: ${r['Optimal Charge Size']}` +
      `\\nOptimal Charge Rate: ${r['Optimal Charge Rate']}` +
      `\\nInert Materials: ${r['Inert Materials']}` +
      `\\n\\n-- Power & Durability --` +
      `\\nPower Consumption: ${r['Power Consumption']}` +
      `\\nHealth: ${fmtNum(r['Health'])}`;

    if (flavorText) val += `\\n\\n${flavorText}`;
    return val;
  },
};
