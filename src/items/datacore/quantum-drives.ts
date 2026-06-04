import { stat } from '../../enrichment/stat-builder';
import type { ItemConfig } from '../../enrichment/item-config';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

// ⚠️ p4kFilter, entityClassPrefix, nameKeyInfix and all fieldSelectors are
// best-effort derivations from community documentation. Verify against real
// unforged game files before relying on them.
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/quantumdrive',
  // qdrv_rsi_s1_atlas → strip 'qdrv_' → 'RSI_S1_ATLAS' → item_NameQDRV_RSI_S1_ATLAS
  entityClassPrefix: 'qdrv_',
  nameKeyInfix: 'QDRV_',
  fieldSelectors: {
    'Max Speed': 'SQuantumDriveComponentParams QuantumDriveParams DriveSpeed',
    'Stage 1 Accel': 'SQuantumDriveComponentParams QuantumDriveParams Stage1AccelSpeed',
    'Stage 2 Accel': 'SQuantumDriveComponentParams QuantumDriveParams Stage2AccelSpeed',
    'Spline Speed': 'SQuantumDriveComponentParams QuantumDriveParams SplineSpeed',
    'Spool Time': 'SQuantumDriveComponentParams QuantumDriveParams SpoolUpTime',
    Cooldown: 'SQuantumDriveComponentParams QuantumDriveParams CooldownTime',
    'Interdiction Delay': 'SQuantumDriveComponentParams QuantumDriveParams InterdictionDelay',
    'Fuel Rate': 'SQuantumDriveComponentParams QuantumDriveParams QuantumFuelRate',
  },
};

export default {
  csvFile: 'quantumdrive.datacore.csv',
  label: 'DC Quantum Drives',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Max Speed', 'Spool Time', 'Cooldown', 'Health'],
  descKeyMatch: (kl) => kl.includes('descqdrv_') || kl.includes('desc_qdrv_') || kl.includes('desc_qrdv_'),
  getTargetKeys: makeGetTargetKeys('qdrv_', 'QDRV_'),
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
