import type { ItemConfig } from '../../enrichment/item-config';
import { stat } from '../../enrichment/stat-builder';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

const fallbackTargetKeys = makeGetTargetKeys('qdrv_', 'QDRV_');

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/quantumdrive',
  // qdrv_rsi_s1_atlas -> strip 'qdrv_' -> 'RSI_S1_ATLAS' -> item_NameQDRV_RSI_S1_ATLAS
  entityClassPrefix: 'qdrv_',
  nameKeyInfix: 'QDRV_',
  fieldSelectors: {
    'Max Speed': { selector: 'SCItemQuantumDriveParams > params', attr: 'driveSpeed' },
    'Stage 1 Accel': { selector: 'SCItemQuantumDriveParams > params', attr: 'stageOneAccelRate' },
    'Stage 2 Accel': { selector: 'SCItemQuantumDriveParams > params', attr: 'stageTwoAccelRate' },
    'Spline Speed': { selector: 'SCItemQuantumDriveParams > splineJumpParams', attr: 'driveSpeed' },
    'Spool Time': { selector: 'SCItemQuantumDriveParams > params', attr: 'spoolUpTime' },
    Cooldown: { selector: 'SCItemQuantumDriveParams > params', attr: 'cooldownTime' },
    'Interdiction Delay': { selector: 'SCItemQuantumDriveParams > params', attr: 'interdictionEffectTime' },
    'Fuel Rate': { selector: 'SCItemQuantumDriveParams', attr: 'quantumFuelRequirement' },
  },
};

function getQuantumDriveAlternateDescKeys(descKey: string): string[] {
  const altKeys = new Set<string>();
  const candidates = [descKey];

  if (/_SCItem$/i.test(descKey)) {
    candidates.push(descKey.replace(/_SCItem$/i, ''));
  } else {
    candidates.push(`${descKey}_SCItem`);
  }

  for (const candidate of candidates) {
    altKeys.add(candidate);
    if (candidate.includes('item_Desc_QDRV_')) {
      altKeys.add(candidate.replace('item_Desc_QDRV_', 'item_DescQDRV_'));
    }
    if (candidate.includes('item_DescQDRV_')) {
      altKeys.add(candidate.replace('item_DescQDRV_', 'item_Desc_QDRV_'));
    }
  }

  altKeys.delete(descKey);
  return [...altKeys];
}

export default {
  csvFile: 'quantumdrive.datacore.csv',
  label: 'DC Quantum Drives',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Max Speed', 'Spool Time', 'Cooldown', 'Health'],
  descKeyMatch: (kl) => kl.includes('descqdrv_') || kl.includes('desc_qdrv_') || kl.includes('desc_qrdv_'),
  getAlternateDescKeys: getQuantumDriveAlternateDescKeys,
  getTargetKeys(row, deriveDescKey) {
    return fallbackTargetKeys(row, deriveDescKey).flatMap((key) => [key, ...getQuantumDriveAlternateDescKeys(key)]);
  },
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Quantum Drive')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Drive Stats --')
      .raw('Max Speed', 'Max Speed')
      .rawIf('Stage 1 Accel', 'Stage 1 Accel')
      .rawIf('Stage 2 Accel', 'Stage 2 Accel')
      .rawIf('Spline Speed', 'Spline Speed')
      .raw('Spool Delay', 'Spool Time')
      .raw('Cooldown', 'Cooldown')
      .rawIf('Interdiction Delay', 'Interdiction Delay')
      .section('-- Fuel --')
      .rawIf('Fuel Rate', 'Fuel Rate')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
