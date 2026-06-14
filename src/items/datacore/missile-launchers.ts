import type { ItemConfig } from '../../enrichment/item-config';
import { dataCoreManufacturerDisplayName } from './manufacturer-display';
import { stat } from '../../enrichment/stat-builder';
import { type DataCoreItemTypeConfig, makeGetTargetKeysFromPrefixMap } from './types';

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/missile_racks',
  entityClassPrefix: 'mrck_',
  nameKeyInfix: 'MRCK_',
  fieldSelectors: {
    'Missile Quantity': {
      selector: 'SItemPortContainerComponentParams SItemPortDef',
      format: 'count',
    },
    'Missile Size': {
      selector: 'SItemPortContainerComponentParams SItemPortDef',
      attr: 'MaxSize',
    },
  },
};

export default {
  csvFile: 'missilelauncher.datacore.csv',
  label: 'DC Missile Launchers',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Missile Quantity', 'Missile Size', 'Health'],
  descKeyMatch: (kl) => kl.includes('descmrck_') || kl.includes('desc_mrck_'),
  getTargetKeys: makeGetTargetKeysFromPrefixMap([
    ['mrck_', 'MRCK_'],
    ['gmrck_', 'MRCK_'],
  ]),
  buildValue(r, flavorText, _oldValue, _targetKey, context) {
    return stat(r)
      .line('Item Type', 'Missile Launcher')
      .line('Manufacturer', dataCoreManufacturerDisplayName(r, context.localizationValue))
      .raw('Size', 'Size')
      .section('-- Carriage --')
      .raw('Missile Quantity', 'Missile Quantity')
      .raw('Missile Size', 'Missile Size')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
