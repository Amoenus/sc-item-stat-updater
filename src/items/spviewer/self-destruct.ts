import type { ItemConfig } from '../../enrichment/item-config';
import { stat } from '../../enrichment/stat-builder';

export default {
  csvFile: 'selfdestruct.spviewer.csv',
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
} satisfies ItemConfig;
