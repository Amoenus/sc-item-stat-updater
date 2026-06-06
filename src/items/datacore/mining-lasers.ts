import type { ItemConfig } from '../../enrichment/item-config';
import { stat } from '../../enrichment/stat-builder';
import { type DataCoreItemTypeConfig, getRawDataCoreTargetKeys } from './types';

// Formats a raw integer percentage modifier (e.g. 25 → '+25%', -35 → '-35%').
function fmtModifier(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '';
  return n > 0 ? `+${n}%` : `${n}%`;
}

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/weapons/mining_laser',
  // Mining laser entity classes are prefixed 'mining_laser_'; INI keys are
  // non-systematic (e.g. item_Mining_MiningLaser_Greycat_Default_S1). The
  // localization keys are read directly from the XML <Localization> tag, so
  // the prefix/infix fallback is rarely exercised.
  entityClassPrefix: 'mining_laser_',
  nameKeyInfix: 'MINING_LASER_',
  fieldSelectors: {
    // Primary mining beam power (ElectricArc hitType).
    'Power Max': {
      selector: 'SWeaponActionFireBeamParams[hitType="ElectricArc"] damagePerSecond DamageInfo',
      attr: 'DamageEnergy',
    },
    // Range at which the laser deals full / minimum damage.
    'Range Max': { selector: 'SWeaponActionFireBeamParams', attr: 'fullDamageRange' },
    'Range Min': { selector: 'SWeaponActionFireBeamParams', attr: 'zeroDamageRange' },
    // Throttle minimum fraction — used to derive Power Min.
    'Throttle Min': { selector: 'SEntityComponentMiningLaserParams', attr: 'throttleMinimum' },
    // Power Min = Power Max × Throttle Min (must follow Power Max and Throttle Min).
    'Power Min': {
      derive: (row) => {
        const powerMax = Number(row['Power Max']);
        const throttleMin = Number(row['Throttle Min']);
        if (!Number.isFinite(powerMax) || !Number.isFinite(throttleMin)) return '';
        return String(Number((powerMax * throttleMin).toFixed(6)));
      },
    },
    // Per-laser rock modifiers (raw integer percentage points, e.g. 25 = +25%).
    'Instability Modifier': {
      selector: 'SEntityComponentMiningLaserParams miningLaserModifiers laserInstability FloatModifierMultiplicative',
      attr: 'value',
    },
    'Resistance Modifier': {
      selector: 'SEntityComponentMiningLaserParams miningLaserModifiers resistanceModifier FloatModifierMultiplicative',
      attr: 'value',
    },
    'Optimal Charge Zone': {
      selector:
        'SEntityComponentMiningLaserParams miningLaserModifiers optimalChargeWindowSizeModifier FloatModifierMultiplicative',
      attr: 'value',
    },
    'Optimal Rate': {
      selector:
        'SEntityComponentMiningLaserParams miningLaserModifiers optimalChargeWindowRateModifier FloatModifierMultiplicative',
      attr: 'value',
    },
    'Inert Materials': {
      selector: 'SEntityComponentMiningLaserParams filterParams filterModifier FloatModifierMultiplicative',
      attr: 'value',
    },
  },
};

export default {
  csvFile: 'weaponmining.datacore.csv',
  label: 'DC Mining Lasers',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Power Max', 'Health'],
  descKeyMatch: (kl) => kl.includes('mininglaser') && kl.includes('_desc'),
  nameKeyToDescKey(nameKey) {
    if (nameKey.startsWith('item_Mining_')) {
      return `${nameKey}_Desc`;
    }
    return nameKey.replace(/(item_)(Name|name|NAME)/, (_m, prefix: string, word: string) => {
      if (word === 'name') return `${prefix}desc`;
      if (word === 'NAME') return `${prefix}DESC`;
      return `${prefix}Desc`;
    });
  },
  getTargetKeys(row, deriveDescKey) {
    const rawKeys = getRawDataCoreTargetKeys(row, deriveDescKey);
    if (rawKeys.length > 0) return rawKeys;

    const entityClass = row['Entity Class'];
    if (!entityClass) return [];
    const suffix = entityClass.replace(/^mining_laser_/i, '').toUpperCase();
    const nameKey = `item_NameMINING_LASER_${suffix}`;
    return [deriveDescKey(nameKey)];
  },
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Mining Laser')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Laser Stats --')
      .raw('Power Max', 'Power Max')
      .rawIf('Power Min', 'Power Min')
      .rawIf('Range Max', 'Range Max')
      .rawIf('Range Min', 'Range Min')
      .section('-- Rock Modifiers --')
      .lineIf('Resistance', fmtModifier(r['Resistance Modifier']))
      .lineIf('Instability', fmtModifier(r['Instability Modifier']))
      .lineIf('Optimal Charge Zone', fmtModifier(r['Optimal Charge Zone']))
      .lineIf('Optimal Rate', fmtModifier(r['Optimal Rate']))
      .lineIf('Inert Materials', fmtModifier(r['Inert Materials']))
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
