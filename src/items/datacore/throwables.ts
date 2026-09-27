import type { ItemConfig } from '../../enrichment/item-config';
import { stat } from '../../enrichment/stat-builder';
import { dataCoreManufacturerDisplayName } from './manufacturer-display';
import { type DataCoreItemTypeConfig, makeGetTargetKeysFromPrefixMap } from './types';

const triggerSelector = 'EntityComponentTriggerableDevicesParams > triggers';
const explosionSelector = `${triggerSelector} explosionParams`;
const damageSelector = `${explosionSelector} DamageInfo`;

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/weapons/throwable',
  entityClassPrefix: 'gren_',
  nameKeyInfix: 'GREN_',
  fieldSelectors: {
    Type: { selector: 'AttachDef', attr: 'SubType' },
    'Damage Physical': { selector: damageSelector, attr: 'DamagePhysical' },
    'Damage Energy': { selector: damageSelector, attr: 'DamageEnergy' },
    'Damage Distortion': { selector: damageSelector, attr: 'DamageDistortion' },
    'Detonation Delay': { selector: `${triggerSelector} STriggerableDevicesTriggerTimerParams`, attr: 'duration' },
    'Explosion Radius': {
      selector: explosionSelector,
      attrs: ['minRadius', 'maxRadius'],
      format: 'number-pair',
    },
    'Explosion Pressure': { selector: explosionSelector, attr: 'pressure' },
  },
};

export default {
  csvFile: 'throwable.datacore.csv',
  label: 'DC Throwables',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size'],
  descKeyMatch: (kl) => kl.includes('desc') && (kl.includes('grenade') || kl.includes('throwable')),
  getTargetKeys: makeGetTargetKeysFromPrefixMap([
    ['behr_gren_frag_', 'behr_frag_grenade_'],
    ['gren_', 'GREN_'],
    ['throwable_', 'THROW_'],
  ]),
  buildValue(r, flavorText, _oldValue, _targetKey, context) {
    return stat(r)
      .line('Item Type', r['Type'] || 'Throwable')
      .line('Manufacturer', dataCoreManufacturerDisplayName(r, context.localizationValue))
      .raw('Size', 'Size')
      .section('-- Damage --')
      .rawIf('Physical', 'Damage Physical')
      .rawIf('Energy', 'Damage Energy')
      .rawIf('Distortion', 'Damage Distortion')
      .section('-- Explosion --')
      .rawIf('Detonation Delay', 'Detonation Delay')
      .rawIf('Radius', 'Explosion Radius')
      .rawIf('Pressure', 'Explosion Pressure')
      .build(flavorText);
  },
} satisfies ItemConfig;
