import { stat } from '../../enrichment/stat-builder';
import type { ItemConfig } from '../../enrichment/item-config';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

const fallbackTargetKeys = makeGetTargetKeys('shld_', 'SHLD_');

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/shieldgenerator',
  // shld_aegs_s04_reclaimer -> strip 'shld_' -> 'AEGS_S04_RECLAIMER' -> item_NameSHLD_AEGS_S04_RECLAIMER
  entityClassPrefix: 'shld_',
  nameKeyInfix: 'SHLD_',
  fieldSelectors: {
    'HP Pool': { selector: 'SCItemShieldGeneratorParams', attr: 'MaxShieldHealth' },
    'Regen Rate': { selector: 'SCItemShieldGeneratorParams', attr: 'MaxShieldRegen' },
    'Regen Time': {
      derive: (row) => {
        const hpPool = Number(row['HP Pool']);
        const regenRate = Number(row['Regen Rate']);
        if (!Number.isFinite(hpPool) || !Number.isFinite(regenRate) || regenRate === 0) return '';
        return Number((hpPool / regenRate).toFixed(2)).toString();
      },
    },
    'Damaged Delay': { selector: 'SCItemShieldGeneratorParams', attr: 'DamagedRegenDelay' },
    'Downed Delay': { selector: 'SCItemShieldGeneratorParams', attr: 'DownedRegenDelay' },
    'Reserve Max Ratio': { selector: 'SCItemShieldGeneratorParams', attr: 'ReservePoolMaxHealthRatio' },
    'Reserve Regen Ratio': { selector: 'SCItemShieldGeneratorParams', attr: 'ReservePoolRegenRateRatio' },
    'Reserve Drain Ratio': { selector: 'SCItemShieldGeneratorParams', attr: 'ReservePoolDrainRateRatio' },
    'Electrical Charge Damage Resistance': {
      selector: 'SCItemShieldGeneratorParams',
      attr: 'ElectricalChargeDamageResistance',
    },
    'Resistance Physical': {
      selector: 'SCItemShieldGeneratorParams ShieldResistance SShieldResistance',
      attrs: ['Max', 'Min'],
      index: 0,
      format: 'percent-pair',
    },
    'Resistance Energy': {
      selector: 'SCItemShieldGeneratorParams ShieldResistance SShieldResistance',
      attrs: ['Max', 'Min'],
      index: 1,
      format: 'percent-pair',
    },
    'Resistance Distortion': {
      selector: 'SCItemShieldGeneratorParams ShieldResistance SShieldResistance',
      attrs: ['Max', 'Min'],
      index: 2,
      format: 'percent-pair',
    },
    'Absorption Physical': {
      selector: 'SCItemShieldGeneratorParams ShieldAbsorption SShieldAbsorption',
      attrs: ['Max', 'Min'],
      index: 0,
      format: 'percent-pair',
    },
    'Absorption Energy': {
      selector: 'SCItemShieldGeneratorParams ShieldAbsorption SShieldAbsorption',
      attrs: ['Max', 'Min'],
      index: 1,
      format: 'percent-pair',
    },
    'Absorption Distortion': {
      selector: 'SCItemShieldGeneratorParams ShieldAbsorption SShieldAbsorption',
      attrs: ['Max', 'Min'],
      index: 2,
      format: 'percent-pair',
    },
    'Distortion Shutdown Damage': { selector: 'SDistortionParams', attr: 'Maximum' },
    'Distortion Decay Delay': { selector: 'SDistortionParams', attr: 'DecayDelay' },
    'Distortion Decay Rate': { selector: 'SDistortionParams', attr: 'DecayRate' },
    'Distortion Shutdown Time': {
      derive: (row) => {
        const maximum = Number(row['Distortion Shutdown Damage']);
        const decayDelay = Number(row['Distortion Decay Delay']);
        const decayRate = Number(row['Distortion Decay Rate']);
        if (
          !Number.isFinite(maximum) ||
          !Number.isFinite(decayDelay) ||
          !Number.isFinite(decayRate) ||
          decayRate === 0
        ) {
          return '';
        }
        return Number((decayDelay + maximum / decayRate).toFixed(2)).toString();
      },
    },
  },
};

function getShieldAlternateDescKeys(descKey: string): string[] {
  const altKeys: string[] = [];
  if (descKey.includes('item_Desc_SHLD_')) {
    altKeys.push(descKey.replace('item_Desc_SHLD_', 'item_DescSHLD_'));
  }
  if (descKey.includes('item_DescSHLD_')) {
    altKeys.push(descKey.replace('item_DescSHLD_', 'item_Desc_SHLD_'));
  }
  return altKeys;
}

export default {
  csvFile: 'shield.datacore.csv',
  label: 'DC Shields',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Grade', 'HP Pool', 'Regen Rate', 'Health'],
  descKeyMatch: (kl) => kl.includes('descshld_') || kl.includes('desc_shld_'),
  getAlternateDescKeys: getShieldAlternateDescKeys,
  getTargetKeys(row, deriveDescKey) {
    return fallbackTargetKeys(row, deriveDescKey).flatMap((key) => [key, ...getShieldAlternateDescKeys(key)]);
  },
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Shield Generator')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Grade', 'Grade')
      .lineIf('Class', r['Class'])
      .section('-- Shield Stats --')
      .raw('Pool HP', 'HP Pool')
      .raw('Regen Rate', 'Regen Rate')
      .rawIf('Regen Time', 'Regen Time')
      .rawIf('Damaged Delay', 'Damaged Delay')
      .rawIf('Downed Delay', 'Downed Delay')
      .section('-- NAV-SCM Reserve --')
      .rawIf('Max Ratio', 'Reserve Max Ratio')
      .rawIf('Regen Ratio', 'Reserve Regen Ratio')
      .rawIf('Drain Ratio', 'Reserve Drain Ratio')
      .section('-- Resistances (Max / Min) --')
      .rawIf('Physical', 'Resistance Physical')
      .rawIf('Energy', 'Resistance Energy')
      .rawIf('Distortion', 'Resistance Distortion')
      .section('-- Absorption (Max / Min) --')
      .rawIf('Physical', 'Absorption Physical')
      .rawIf('Energy', 'Absorption Energy')
      .rawIf('Distortion', 'Absorption Distortion')
      .section('-- Distortion --')
      .rawIf('Shutdown Damage', 'Distortion Shutdown Damage')
      .rawIf('Decay Delay', 'Distortion Decay Delay')
      .rawIf('Decay Rate', 'Distortion Decay Rate')
      .rawIf('Shutdown Time', 'Distortion Shutdown Time')
      .rawIf('Electrical Charge Resistance', 'Electrical Charge Damage Resistance')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
