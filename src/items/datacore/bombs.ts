import type { ItemConfig } from '../../enrichment/item-config';
import { stat } from '../../enrichment/stat-builder';
import { dataCoreManufacturerDisplayName } from './manufacturer-display';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

const bombSelector = 'SCItemBombParams';
const explosionSelector = `${bombSelector} explosionParams`;
const damageSelector = `${explosionSelector} DamageInfo`;

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/weapons/missiles',
  recordSelector: bombSelector,
  entityClassPrefix: 'bomb_',
  nameKeyInfix: 'BOMB_',
  fieldSelectors: {
    'Damage Total': {
      selector: damageSelector,
      attrs: ['DamagePhysical', 'DamageEnergy', 'DamageDistortion'],
      format: 'sum',
    },
    'Damage Physical': { selector: damageSelector, attr: 'DamagePhysical' },
    'Damage Energy': { selector: damageSelector, attr: 'DamageEnergy' },
    'Damage Distortion': { selector: damageSelector, attr: 'DamageDistortion' },
    'Arm Delay': { selector: bombSelector, attr: 'armTime' },
    'Ignite Delay': { selector: bombSelector, attr: 'igniteTime' },
    'Explosion Radius': { selector: explosionSelector, attr: 'maxRadius' },
    'Explosion Proximity': { selector: bombSelector, attr: 'projectileProximity' },
  },
};

export default {
  csvFile: 'bomb.datacore.csv',
  label: 'DC Bombs',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Damage Total', 'Arm Delay', 'Explosion Radius', 'Health'],
  descKeyMatch: (kl) => kl.includes('descbomb_'),
  getTargetKeys: makeGetTargetKeys('bomb_', 'BOMB_'),
  buildValue(r, flavorText, _oldValue, _targetKey, context) {
    return stat(r)
      .line('Item Type', 'Bomb')
      .line('Manufacturer', dataCoreManufacturerDisplayName(r, context.localizationValue))
      .raw('Size', 'Size')
      .section('-- Damage --')
      .raw('Total Damage', 'Damage Total')
      .rawIf('Physical', 'Damage Physical')
      .rawIf('Energy', 'Damage Energy')
      .rawIf('Distortion', 'Damage Distortion')
      .section('-- Stats --')
      .raw('Arm Delay', 'Arm Delay')
      .raw('Ignite Delay', 'Ignite Delay')
      .rawIf('Proximity', 'Explosion Proximity')
      .raw('Explosion Radius', 'Explosion Radius')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
