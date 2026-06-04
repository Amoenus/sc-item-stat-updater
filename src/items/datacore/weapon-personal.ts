import { stat } from '../../enrichment/stat-builder';
import type { ItemConfig } from '../../enrichment/item-config';
import { type DataCoreItemTypeConfig, makeGetTargetKeysFromPrefixMap } from './types';

// ⚠️ FPS weapon entity class prefixes are highly variable (pistol_, smg_, rifle_,
// sniper_, shotgun_, lmg_, etc.). No single prefix pattern covers all types.
// getTargetKeys uses a best-effort approach that attempts prefix stripping.
// Verify all fields and prefixes against real unforged game files.
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/weapons/fps_weapons',
  // No consistent prefix — use empty string to uppercase the full class name.
  // This will only produce correct keys for types where the INI key matches
  // the uppercased entity class directly.
  entityClassPrefix: '',
  nameKeyInfix: '',
  fieldSelectors: {
    'Damage Alpha':
      'SWeaponComponentParams SWeaponActionFireSingleParams ProjectileLaunchParams DamageInfo DamageEntry damage',
    'Rate of Fire': 'SWeaponComponentParams SWeaponActionFireSingleParams fireRate',
    'Fire Mode': 'SWeaponComponentParams SWeaponActionFireSingleParams fireMode',
    'Projectile Speed': 'SWeaponComponentParams SWeaponActionFireSingleParams ProjectileLaunchParams speed',
    'Ammo Range': 'SWeaponComponentParams SWeaponActionFireSingleParams ProjectileLaunchParams range',
    'Ammo Quantity': 'SAmmoContainerComponentParams capacity',
  },
};

export default {
  csvFile: 'weaponpersonal.datacore.csv',
  label: 'DC Personal Weapons',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Damage Alpha', 'Rate of Fire'],
  descKeyMatch: (kl) =>
    (kl.includes('desc') &&
      (kl.includes('_pistol') ||
        kl.includes('_smg') ||
        kl.includes('_rifle') ||
        kl.includes('_sniper') ||
        kl.includes('_shotgun') ||
        kl.includes('_lmg'))) ||
    ((kl.includes('descgmni_') || kl.includes('descbehr_') || kl.includes('descklwe_') || kl.includes('descksar_')) &&
      !kl.includes('optics') &&
      !kl.includes('barrel')),
  // ⚠️ Personal weapon key derivation: entity class names vary greatly.
  // This implementation strips common FPS weapon prefixes. Items whose entity
  // class doesn't match any known pattern will produce empty target key lists
  // (skipped silently). Expand the prefix list as real data is available.
  getTargetKeys: makeGetTargetKeysFromPrefixMap([
    // Known FPS weapon prefixes and their INI key mappings
    ['pistol_', 'PISTOL_'],
    ['smg_', 'SMG_'],
    ['rifle_', 'RIFLE_'],
    ['sniper_', 'SNIPER_'],
    ['shotgun_', 'SHOTGUN_'],
    ['lmg_', 'LMG_'],
  ]),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', r['Type'] || 'Personal Weapon')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .rawIf('Fire Mode', 'Fire Mode')
      .section('-- Damage --')
      .raw('Alpha Damage', 'Damage Alpha')
      .raw('Rate of Fire', 'Rate of Fire', ' RPM')
      .section('-- Ballistics --')
      .rawIf('Speed', 'Projectile Speed', ' m/s')
      .rawIf('Range', 'Ammo Range', 'm')
      .rawIf('Ammo', 'Ammo Quantity')
      .build(flavorText);
  },
} satisfies ItemConfig;
