import { stat } from '../../lib/format/stat-builder';
import type { ItemConfig } from '../../lib/types';
import type { DataCoreItemTypeConfig } from './types';

// ⚠️ Throwable entity class prefixes vary (gren_, throwable_, etc.).
// Verify p4kFilter and all field paths against real game files.
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/weapons/throwable',
  entityClassPrefix: 'gren_',
  nameKeyInfix: 'GREN_',
  fieldSelectors: {
    Type: 'SThrowableComponentParams ThrowableParams type',
    'Damage Physical': 'SProjectileComponentParams BulletParams DamagePhysical',
    'Damage Energy': 'SProjectileComponentParams BulletParams DamageEnergy',
    'Damage Distortion': 'SProjectileComponentParams BulletParams DamageDistortion',
    'Detonation Delay': 'SThrowableComponentParams ThrowableParams detonationDelay',
    'Explosion Radius': 'SThrowableComponentParams ThrowableParams explosionRadius',
    'Explosion Pressure': 'SThrowableComponentParams ThrowableParams explosionPressure',
  },
};

export default {
  csvFile: 'throwable.datacore.csv',
  label: 'DC Throwables',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size'],
  descKeyMatch: (kl) => kl.includes('desc') && (kl.includes('grenade') || kl.includes('throwable')),
  // ⚠️ Throwable key derivation: 'gren_' is the most common prefix but not
  // universal. Items not matching will silently produce no updates.
  getTargetKeys(row, deriveDescKey) {
    const entityClass = row['Entity Class'];
    if (!entityClass) return [];
    const prefixMap: Array<[string, string]> = [
      ['gren_', 'GREN_'],
      ['throwable_', 'THROW_'],
    ];
    for (const [pfx, infix] of prefixMap) {
      if (entityClass.toLowerCase().startsWith(pfx)) {
        const suffix = entityClass.slice(pfx.length).toUpperCase();
        return [deriveDescKey(`item_Name${infix}${suffix}`)];
      }
    }
    return [];
  },
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', r['Type'] || 'Throwable')
      .raw('Manufacturer', 'Manufacturer')
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
