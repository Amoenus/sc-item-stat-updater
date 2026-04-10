// @ts-check
import { stat } from '../../lib/format/stat-builder.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'spviewer/miningmodifier.spviewer.csv',
  label: 'SP Mining Modifiers',
  nameColumn: 'Name',
  requiredColumns: ['Name', 'Manufacturer', 'Size', 'Type', 'Charges', 'Duration'],
  descKeyMatch: (kl) =>
    (kl.startsWith('item_mining_consumable_') && kl.endsWith('_desc')) ||
    (kl.startsWith('item_mining_gadget_') && kl.endsWith('_desc')) ||
    (kl.startsWith('item_mining_modules_') && kl.endsWith('_desc')),
  nameKeyToDescKey: (nameKey) => (nameKey.endsWith('_Name') ? nameKey.replace(/_Name$/, '_Desc') : `${nameKey}_Desc`),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', r['Type'] || 'Mining Modifier')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Charges', 'Charges')
      .raw('Duration', 'Duration')
      .section('-- Power Modifiers --')
      .rawIf('Mining Power', 'Power Modifier Mining')
      .rawIf('Extract Power', 'Power Modifier Extract')
      .section('-- Rock Modifiers --')
      .rawIf('Resistance', 'Rock Modifier Resistance')
      .rawIf('Instability', 'Rock Modifier Instability')
      .rawIf('Optimal Charge Zone', 'Rock Modifier Optimal Charge Zone')
      .rawIf('Optimal Rate', 'Rock Modifier Optimal Rate')
      .rawIf('Shatter Damage', 'Rock Modifier Shatter Damage')
      .rawIf('Cluster Factor', 'Rock Modifier Cluster Factor')
      .rawIf('Overcharge Rate', 'Rock Modifier Overcharge Rate')
      .rawIf('Inert Materials', 'Rock Modifier Inert Materials')
      .build(flavorText);
  },
};
