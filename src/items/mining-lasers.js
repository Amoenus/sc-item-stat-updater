// @ts-check
import { stat } from '../lib/stat-builder.js';

/** @type {import('../lib/types.js').ItemConfig} */
export default {
  csvFile: 'mining_lasers.csv',
  label: 'Mining Lasers',
  requiredColumns: [
    'Localization Key',
    'Manufacturer',
    'Size',
    'Output Pwr/s',
    'Gadget Slots',
    'Full Dmg Range',
    'Zero Dmg Range',
    'Throttle Lerp Speed',
    'Resistance',
    'Laser Instability',
    'Optimal Charge Size',
    'Optimal Charge Rate',
    'Inert Materials',
    'Power Consumption',
    'Health',
  ],
  descKeyMatch: (kl) => kl.includes('mininglaser') && kl.includes('_desc'),
  nameKeyToDescKey(nameKey) {
    if (nameKey.startsWith('item_Mining_')) {
      return `${nameKey}_Desc`;
    }
    return nameKey.replace(/(item_)(Name|name|NAME)/, (_m, prefix, word) => {
      if (word === 'name') return `${prefix}desc`;
      if (word === 'NAME') return `${prefix}DESC`;
      return `${prefix}Desc`;
    });
  },
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Mining Laser')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Mining Stats --')
      .num('Output Power', 'Output Pwr/s')
      .raw('Gadget Slots', 'Gadget Slots')
      .raw('Full Dmg Range', 'Full Dmg Range', 'm')
      .raw('Zero Dmg Range', 'Zero Dmg Range', 'm')
      .raw('Throttle Lerp Speed', 'Throttle Lerp Speed')
      .section('-- Modifiers --')
      .raw('Resistance', 'Resistance')
      .raw('Laser Instability', 'Laser Instability')
      .raw('Optimal Charge Size', 'Optimal Charge Size')
      .raw('Optimal Charge Rate', 'Optimal Charge Rate')
      .raw('Inert Materials', 'Inert Materials')
      .section('-- Power & Durability --')
      .raw('Power Consumption', 'Power Consumption')
      .num('Health', 'Health')
      .build(flavorText);
  },
};
