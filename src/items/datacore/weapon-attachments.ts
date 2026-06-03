import { stat } from '../../lib/format/stat-builder';
import type { ItemConfig } from '../../lib/types';
import { makeGetTargetKeysFromPrefixMap, type DataCoreItemTypeConfig } from './types';

// ⚠️ Weapon attachment entity classes vary greatly (optic_, barrel_, under_, etc.).
// The p4kFilter and key derivation are speculative — verify against real game files.
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/weapons/weapon_modifier',
  entityClassPrefix: '',
  nameKeyInfix: '',
  fieldSelectors: {
    Slot: 'SItemPortComponentParams itemPortParams type',
    'Damage Modifier': 'SWeaponAttachmentComponentParams attachmentParams damageModifier',
    'Projectile Speed Modifier': 'SWeaponAttachmentComponentParams attachmentParams projectileSpeedModifier',
    'Heat Modifier': 'SWeaponAttachmentComponentParams attachmentParams heatModifier',
    Magnification: 'SWeaponAttachmentComponentParams attachmentParams magnification',
    'Aim Time Modifier': 'SWeaponAttachmentComponentParams attachmentParams adsAimTimeModifier',
    'Sound Radius Modifier': 'SWeaponAttachmentComponentParams attachmentParams soundRadiusModifier',
  },
};

export default {
  csvFile: 'weaponattachment.datacore.csv',
  label: 'DC Weapon Attachments',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size'],
  descKeyMatch: (kl) =>
    kl.includes('desc') &&
    (kl.includes('barrel') || kl.includes('scope') || kl.includes('attachment') || kl.includes('optics')),
  // ⚠️ Attachment INI key derivation requires knowing the attachment-type prefix.
  // Common prefixes: optic_, barrel_, under_, stock_. No single rule covers all.
  // This implementation attempts prefix matching; expand as real data is available.
  getTargetKeys: makeGetTargetKeysFromPrefixMap([
    ['optic_', 'OPTIC_'],
    ['barrel_', 'BARREL_'],
    ['under_', 'UNDER_'],
    ['stock_', 'STOCK_'],
    ['grip_', 'GRIP_'],
  ]),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', r['Type'] || 'Weapon Attachment')
      .raw('Manufacturer', 'Manufacturer')
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
