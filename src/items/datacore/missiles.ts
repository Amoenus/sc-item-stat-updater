import type { ItemConfig } from '../../enrichment/item-config';
import { stat } from '../../enrichment/stat-builder';
import { type DataCoreItemTypeConfig, makeGetTargetKeysFromPrefixMap } from './types';

const missileSelector = 'SCItemMissileParams';
const explosionSelector = `${missileSelector} explosionParams`;
const damageSelector = `${explosionSelector} DamageInfo`;
const targetingSelector = `${missileSelector} targetingParams`;
const gcsSelector = `${missileSelector} GCSParams`;

function isUnavailableRange(value: string): boolean {
  const parts = (value.match(/-?\d+(?:\.\d+)?/g) ?? [])
    .map((part) => Number(part))
    .filter((part) => Number.isFinite(part));
  return parts.length > 0 && parts.every((part) => part < 0);
}

function displayValue(row: Record<string, string>, column: string): string {
  const value = row[column] ?? '';
  return isUnavailableRange(value) ? '' : value;
}

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/weapons/missiles',
  recordSelector: missileSelector,
  entityClassPrefix: 'msil_',
  nameKeyInfix: 'MISL_',
  fieldSelectors: {
    'Tracking Signal': { selector: targetingSelector, attr: 'trackingSignalType' },
    'Damage Total': {
      selector: damageSelector,
      attrs: ['DamagePhysical', 'DamageEnergy', 'DamageDistortion'],
      format: 'sum',
    },
    'Damage Physical': { selector: damageSelector, attr: 'DamagePhysical' },
    'Damage Energy': { selector: damageSelector, attr: 'DamageEnergy' },
    'Damage Distortion': { selector: damageSelector, attr: 'DamageDistortion' },
    Speed: { selector: gcsSelector, attr: 'linearSpeed' },
    'Arm Delay': { selector: missileSelector, attr: 'armTime' },
    'Lock Delay': { selector: targetingSelector, attr: 'lockTime' },
    'Lock Range': {
      selector: targetingSelector,
      attrs: ['lockRangeMin', 'lockRangeMax'],
      format: 'number-pair',
    },
    'Lock Angle': { selector: targetingSelector, attr: 'lockingAngle' },
    'Explosion Radius': {
      selector: explosionSelector,
      attrs: ['minRadius', 'maxRadius'],
      format: 'number-pair',
    },
  },
};

export default {
  csvFile: 'missile.datacore.csv',
  label: 'DC Missiles',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Damage Total', 'Speed', 'Arm Delay', 'Health'],
  descKeyMatch: (kl) => kl.includes('descmisl_') || kl.includes('descgmisl_'),
  getTargetKeys: makeGetTargetKeysFromPrefixMap([
    ['msil_', 'MISL_'],
    ['gmisl_', 'GMISL_'],
  ]),
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
      .lineIf('Lock Range', displayValue(r, 'Lock Range'))
      .rawIf('Lock Angle', 'Lock Angle')
      .section('-- Explosion --')
      .rawIf('Radius', 'Explosion Radius')
      .rawIf('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
