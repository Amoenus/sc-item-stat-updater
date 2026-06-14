import type { ItemConfig } from '../../enrichment/item-config';
import { dataCoreManufacturerDisplayName } from './manufacturer-display';
import { stat } from '../../enrichment/stat-builder';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/selfdestruct',
  entityClassPrefix: 'vhcl_selfdestruct_',
  nameKeyInfix: 'SelfDestruct_',
  fieldSelectors: {
    Countdown: { selector: 'SSCItemSelfDestructComponentParams', attr: 'time' },
    'Explosion Damage': { selector: 'SSCItemSelfDestructComponentParams', attr: 'damage' },
    'Explosion Radius': {
      selector: 'SSCItemSelfDestructComponentParams',
      attrs: ['minRadius', 'radius'],
      format: 'number-pair',
    },
  },
};

export default {
  csvFile: 'selfdestruct.datacore.csv',
  label: 'DC Self Destruct',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size'],
  descKeyMatch: (kl) => kl.includes('desc') && kl.includes('selfdestruct'),
  getTargetKeys: makeGetTargetKeys('vhcl_selfdestruct_', 'SelfDestruct_'),
  buildValue(r, flavorText, _oldValue, _targetKey, context) {
    return stat(r)
      .line('Item Type', 'Self Destruct')
      .line('Manufacturer', dataCoreManufacturerDisplayName(r, context.localizationValue))
      .raw('Size', 'Size')
      .section('-- Explosion --')
      .rawIf('Countdown', 'Countdown')
      .rawIf('Damage', 'Explosion Damage')
      .rawIf('Radius', 'Explosion Radius')
      .build(flavorText);
  },
} satisfies ItemConfig;
