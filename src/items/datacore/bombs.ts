import { stat } from '../../lib/format/stat-builder';
import type { ItemConfig } from '../../lib/types';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

// ⚠️ Verify p4kFilter, entityClassPrefix, nameKeyInfix and fieldSelectors
// against real unforged game files.
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/weapons/missiles',
  // bomb_behr_s2_caterpillar → strip 'bomb_' → 'BEHR_S2_CATERPILLAR'
  entityClassPrefix: 'bomb_',
  nameKeyInfix: 'BOMB_',
  fieldSelectors: {
    'Damage Total': 'SProjectileComponentParams BulletParams DamageTotal',
    'Damage Physical': 'SProjectileComponentParams BulletParams DamagePhysical',
    'Damage Energy': 'SProjectileComponentParams BulletParams DamageEnergy',
    'Damage Distortion': 'SProjectileComponentParams BulletParams DamageDistortion',
    'Arm Delay': 'SBombComponentParams BombParams ArmTime',
    'Ignite Delay': 'SBombComponentParams BombParams IgniteTime',
    'Explosion Radius': 'SBombComponentParams BombParams ExplosionRadius',
    'Explosion Proximity': 'SBombComponentParams BombParams ProximityTriggerRadius',
  },
};

export default {
  csvFile: 'bomb.datacore.csv',
  label: 'DC Bombs',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Damage Total', 'Arm Delay', 'Explosion Radius', 'Health'],
  descKeyMatch: (kl) => kl.includes('descbomb_'),
  getTargetKeys: makeGetTargetKeys('bomb_', 'BOMB_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Bomb')
      .raw('Manufacturer', 'Manufacturer')
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
