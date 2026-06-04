import { stat } from '../../enrichment/stat-builder';
import type { ItemConfig } from '../../lib/types';
import { isWeaponDescKey } from '../shared/weapon-matchers';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

// ⚠️ Verify p4kFilter, entityClassPrefix, nameKeyInfix and fieldSelectors
// against real unforged game files. Vehicle gun entity class prefixes vary —
// common prefixes include 'mgun_', 'gun_', and manufacturer codes directly.
// The nameKeyInfix is the most uncertain value here.
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/weapons',
  // mgun_kbar_s3_talon → strip 'mgun_' → 'KBAR_S3_TALON'
  entityClassPrefix: 'mgun_',
  nameKeyInfix: 'MGUN_',
  fieldSelectors: {
    'Damage Alpha':
      'SWeaponComponentParams SWeaponActionFireSingleParams ProjectileLaunchParams DamageInfo DamageEntry damage',
    'Rate of Fire': 'SWeaponComponentParams SWeaponActionFireSingleParams fireRate',
    'Projectile Speed': 'SWeaponComponentParams SWeaponActionFireSingleParams ProjectileLaunchParams speed',
    'Ammo Range': 'SWeaponComponentParams SWeaponActionFireSingleParams ProjectileLaunchParams range',
    'Ammo Quantity': 'SAmmoContainerComponentParams capacity',
    'Heat Per Shot': 'SWeaponComponentParams SWeaponActionFireSingleParams heatPerShot',
  },
};

export default {
  csvFile: 'weapongun.datacore.csv',
  label: 'DC Weapon Guns',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Damage Alpha', 'Rate of Fire', 'Health'],
  descKeyMatch: isWeaponDescKey,
  // Vehicle weapon INI key derivation: entity class varies widely.
  // ⚠️ This pattern only works for entities with 'mgun_' prefix.
  // Weapon types with other prefixes will produce no-op updates.
  getTargetKeys: makeGetTargetKeys('mgun_', 'MGUN_'),
  buildValue(r, flavorText) {
    const hasAmmo = r['Ammo Quantity'] && r['Ammo Quantity'] !== '0' && r['Ammo Quantity'] !== '';

    const s = stat(r)
      .line('Item Type', r['Type'] || 'Vehicle Gun')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Combat Stats --')
      .raw('Alpha Damage', 'Damage Alpha')
      .raw('Rate of Fire', 'Rate of Fire', ' RPM')
      .rawIf('Projectile Speed', 'Projectile Speed', ' m/s')
      .rawIf('Range', 'Ammo Range', 'm');

    if (hasAmmo) {
      s.section('-- Ammo --').raw('Ammo Count', 'Ammo Quantity');
    }

    s.section('-- Heat --');
    if (r['Heat Per Shot'] && r['Heat Per Shot'] !== '0') s.raw('Heat Per Shot', 'Heat Per Shot');

    return s.section('-- Durability --').raw('Health', 'Health').build(flavorText);
  },
} satisfies ItemConfig;
