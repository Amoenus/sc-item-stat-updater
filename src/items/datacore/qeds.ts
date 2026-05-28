import { stat } from '../../lib/format/stat-builder';
import type { ItemConfig } from '../../lib/types';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

// ⚠️ QED (Quantum Enforcement Device / Quantum Interdiction Generator) entity
// class prefix and DataForge paths are speculative. INI keys use both
// 'descqdmp_' and 'descqed_' prefixes. Verify against real game files.
export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/weapons/qig',
  // qig_ksar_s3_boreas → strip 'qig_' → 'KSAR_S3_BOREAS'
  entityClassPrefix: 'qig_',
  nameKeyInfix: 'QDMP_',
  fieldSelectors: {
    'Jammer Range': 'SQuantumInterdictionGeneratorComponentParams QIGParams JammerRange',
    'Interdiction Range': 'SQuantumInterdictionGeneratorComponentParams QIGParams InterdictionRange',
    'Charge Delay': 'SQuantumInterdictionGeneratorComponentParams QIGParams ChargeTime',
    'Activation Delay': 'SQuantumInterdictionGeneratorComponentParams QIGParams ActivationDelay',
    Cooldown: 'SQuantumInterdictionGeneratorComponentParams QIGParams CooldownTime',
  },
};

export default {
  csvFile: 'qed.datacore.csv',
  label: 'DC QEDs',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Jammer Range'],
  descKeyMatch: (kl) => kl.includes('descqdmp_') || kl.includes('descqed_'),
  getTargetKeys: makeGetTargetKeys('qig_', 'QDMP_'),
  buildValue(r, flavorText) {
    const hasSnare = r['Interdiction Range'] && r['Interdiction Range'] !== '0';

    const s = stat(r)
      .line('Item Type', hasSnare ? 'Quantum Enforcement Device' : 'Quantum Dampener')
      .raw('Manufacturer', 'Manufacturer')
      .rawIf('Size', 'Size')
      .section('-- QED Stats --')
      .raw('Jammer Range', 'Jammer Range');

    if (hasSnare) {
      s.raw('Interdiction Range', 'Interdiction Range');
    }

    return s
      .rawIf('Charge Delay', 'Charge Delay')
      .rawIf('Activation Delay', 'Activation Delay')
      .rawIf('Cooldown', 'Cooldown')
      .build(flavorText);
  },
} satisfies ItemConfig;
