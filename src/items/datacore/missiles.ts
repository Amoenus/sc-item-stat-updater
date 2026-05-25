import { stat } from '../../lib/format/stat-builder';
import type { ItemConfig } from '../../lib/types';
import { makeGetTargetKeys, type DataCoreItemTypeConfig } from './types';

// ⚠️ Verify p4kFilter, entityClassPrefix, nameKeyInfix and fieldSelectors
// against real unforged game files. Missiles may live under scitemweapon_missile
// or scitemvehicle_weaponmissile. Field names inferred from community data.
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/weapons/missiles',
  // msil_behr_s1_javelinII → strip 'msil_' → 'BEHR_S1_JAVELINII' → item_NameMISL_BEHR_S1_JAVELINII
  entityClassPrefix: 'msil_',
  nameKeyInfix: 'MISL_',
  fieldSelectors: {
    'Tracking Signal': 'SMissileComponentParams MissileParams TrackingType',
    'Damage Total': 'SProjectileComponentParams BulletParams DamageTotal',
    'Damage Physical': 'SProjectileComponentParams BulletParams DamagePhysical',
    'Damage Energy': 'SProjectileComponentParams BulletParams DamageEnergy',
    'Damage Distortion': 'SProjectileComponentParams BulletParams DamageDistortion',
    'Speed': 'SMissileComponentParams MissileParams MaxSpeed',
    'Arm Delay': 'SMissileComponentParams MissileParams ArmTime',
    'Lock Delay': 'SMissileComponentParams MissileParams LockTime',
    'Lock Range': 'SMissileComponentParams MissileParams TrackingDistanceMax',
    'Lock Angle': 'SMissileComponentParams MissileParams TrackingAngle',
    'Explosion Radius': 'SMissileComponentParams MissileParams ExplosionRadius',
  },
};

export default {
  csvFile: 'missile.datacore.csv',
  label: 'DC Missiles',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Damage Total', 'Speed', 'Arm Delay', 'Health'],
  descKeyMatch: (kl) => kl.includes('descmisl_') || kl.includes('descgmisl_'),
  getTargetKeys: makeGetTargetKeys('msil_', 'MISL_'),
  buildValue(r, flavorText) {
    const TORPEDO_MIN_SIZE = 7;
    const isTorpedo = Number.parseInt(r['Size'], 10) >= TORPEDO_MIN_SIZE;

    return stat(r)
      .line('Item Type', isTorpedo ? 'Torpedo' : 'Missile')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .rawIf('Tracking Signal', 'Tracking Signal')
      .section('-- Damage --')
      .raw('Total Damage', 'Damage Total')
      .rawIf('Physical', 'Damage Physical')
      .rawIf('Energy', 'Damage Energy')
      .rawIf('Distortion', 'Damage Distortion')
      .section('-- Flight --')
      .raw('Speed', 'Speed', ' m/s')
      .rawIf('Arm Delay', 'Arm Delay')
      .rawIf('Lock Delay', 'Lock Delay')
      .section('-- Lock --')
      .rawIf('Lock Range', 'Lock Range')
      .rawIf('Lock Angle', 'Lock Angle')
      .section('-- Explosion --')
      .rawIf('Radius', 'Explosion Radius')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
