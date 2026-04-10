// @ts-check
import { stat } from '../../lib/format/stat-builder.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'spviewer/weaponmining.spviewer.csv',
  label: 'SP Mining Lasers',
  nameColumn: 'Name',
  lookupCsvFile: 'erkul/mining_lasers.csv',
  requiredColumns: [
    'Name',
    'Manufacturer',
    'Size',
    'Laser Power Max',
    'Laser Power Min',
    'Range Power Max',
    'Range Power Min',
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
      .rawIf('Module Slots', 'Module  Slots')
      .section('-- Laser Stats --')
      .raw('Power Max', 'Laser Power Max')
      .raw('Power Min', 'Laser Power Min')
      .raw('Range Max', 'Range Power Max')
      .raw('Range Min', 'Range Power Min')
      .rawIf('Throttle Lerp', 'Throttle  Lerp Speed')
      .section('-- Rock Modifiers --')
      .rawIf('Resistance', 'Rock Modifier Resistance')
      .rawIf('Instability', 'Rock Modifier Instability')
      .rawIf('Optimal Charge Zone', 'Rock Modifier Optimal Charge Zone')
      .rawIf('Optimal Rate', 'Rock Modifier Optimal Rate')
      .rawIf('Inert Materials', 'Rock Modifier Inert Materials')
      .section('-- Emission --')
      .rawIf('EM Active', 'EM Emit Active')
      .rawIf('IR', 'IR Emit')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .rawIf('Distortion Shutdown', 'Distortion Resistance Shutdown Dmg')
      .build(flavorText);
  },
};
