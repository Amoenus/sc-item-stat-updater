// @ts-check
import { stat } from '../../lib/format/stat-builder.js';

/** @type {import('../../lib/types.js').ItemConfig} */
export default {
  csvFile: 'spviewer/selfdestruct.spviewer.csv',
  label: 'SP Self Destruct',
  nameColumn: 'Name',
  requiredColumns: ['Name', 'Manufacturer', 'Size'],
  descKeyMatch: (kl) => kl.includes('desc') && kl.includes('selfdestruct'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Self Destruct')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Explosion --')
      .rawIf('Countdown', 'Explosion Countdown')
      .rawIf('Damage', 'Explosion Damage')
      .rawIf('Radius', 'Explosion Radius')
      .build(flavorText);
  },
};
