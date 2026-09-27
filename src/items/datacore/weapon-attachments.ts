import type { ItemConfig } from '../../enrichment/item-config';
import { stat } from '../../enrichment/stat-builder';
import { dataCoreManufacturerDisplayName } from './manufacturer-display';
import { type DataCoreItemTypeConfig, makeGetTargetKeysFromPrefixMap } from './types';

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/weapons/weapon_modifier',
  recordSelector: 'SWeaponModifierComponentParams',
  entityClassPrefix: '',
  nameKeyInfix: '',
  fieldSelectors: {
    Slot: { derive: (row) => row['Class'] },
    'Damage Modifier': { selector: 'SWeaponModifierComponentParams weaponStats', attr: 'damageMultiplier' },
    'Projectile Speed Modifier': {
      selector: 'SWeaponModifierComponentParams weaponStats',
      attr: 'projectileSpeedMultiplier',
    },
    'Heat Modifier': { selector: 'SWeaponModifierComponentParams weaponStats', attr: 'heatGenerationMultiplier' },
    Magnification: {
      selector: 'SWeaponModifierComponentParams aimModifier',
      attrs: ['zoomScale', 'secondZoomScale'],
      format: 'number-pair',
      separator: ' / ',
    },
    'Aim Time Modifier': { selector: 'SWeaponModifierComponentParams aimModifier', attr: 'zoomTimeScale' },
    'Sound Radius Modifier': { selector: 'SWeaponModifierComponentParams weaponStats', attr: 'soundRadiusMultiplier' },
  },
};

export default {
  csvFile: 'weaponattachment.datacore.csv',
  label: 'DC Weapon Attachments',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size'],
  descKeyMatch: (kl) =>
    kl.includes('desc') &&
    (kl.includes('barrel') || kl.includes('scope') || kl.includes('attachment') || kl.includes('optics')),
  getTargetKeys: makeGetTargetKeysFromPrefixMap([
    ['optic_', 'OPTIC_'],
    ['barrel_', 'BARREL_'],
    ['under_', 'UNDER_'],
    ['stock_', 'STOCK_'],
    ['grip_', 'GRIP_'],
  ]),
  buildValue(r, flavorText, _oldValue, _targetKey, context) {
    return stat(r)
      .line('Item Type', r['Type'] || 'Weapon Attachment')
      .line('Manufacturer', dataCoreManufacturerDisplayName(r, context.localizationValue))
      .raw('Size', 'Size')
      .rawIf('Slot', 'Slot')
      .section('-- Weapon Modifiers --')
      .rawIf('Damage', 'Damage Modifier')
      .rawIf('Projectile Speed', 'Projectile Speed Modifier')
      .rawIf('Heat Generation', 'Heat Modifier')
      .rawIf('Sound Radius', 'Sound Radius Modifier')
      .section('-- ADS --')
      .rawIf('Magnification', 'Magnification')
      .rawIf('Aim Time', 'Aim Time Modifier')
      .build(flavorText);
  },
} satisfies ItemConfig;
