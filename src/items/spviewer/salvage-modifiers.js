// @ts-check
import { stat } from '../../lib/format/stat-builder.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'spviewer/salvagemodifier.spviewer.csv',
  label: 'SP Salvage Modifiers',
  nameColumn: 'Name',
  requiredColumns: ['Name', 'Manufacturer', 'Size'],
  descKeyMatch: (kl) =>
    (kl.startsWith('item_scraper_') && kl.endsWith('_desc')) || kl === 'item_descgrin_tractorbeam_module_001',
  nameKeyToDescKey: (nameKey) =>
    nameKey.endsWith('_Name') ? nameKey.replace(/_Name$/, '_Desc') : nameKey.replace(/^item_Name/, 'item_Desc'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Salvage Modifier')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Salvage Stats --')
      .rawIf('Speed Multiplier', 'Multiplier Speed')
      .rawIf('Radius Multiplier', 'Multiplier Radius')
      .rawIf('Extraction Efficiency', 'Extraction  Efficiency')
      .build(flavorText);
  },
};
