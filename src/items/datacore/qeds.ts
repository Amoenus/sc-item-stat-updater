import type { ItemConfig } from '../../enrichment/item-config';
import { dataCoreManufacturerDisplayName } from './manufacturer-display';
import { stat } from '../../enrichment/stat-builder';
import { type DataCoreItemTypeConfig, makeGetTargetKeysFromPrefixMap } from './types';

const pulseParamsSelector =
  'SCItemQuantumInterdictionGeneratorParams > quantumInterdictionPulseSettings SCItemQuantumInterdictionPulseParams';

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: ['scitem/ships/quantumenforcementdevice', 'scitem/ships/weapons/qig'],
  entityClassPrefix: 'qdmp_',
  nameKeyInfix: 'QDMP_',
  fieldSelectors: {
    'Jammer Range': {
      selector: 'SCItemQuantumInterdictionGeneratorParams > jammerSettings SCItemQuantumJammerParams',
      attr: 'jammerRange',
    },
    'Interdiction Range': { selector: pulseParamsSelector, attr: 'radiusMeters' },
    'Charge Delay': { selector: pulseParamsSelector, attr: 'chargeTimeSecs' },
    'Activation Delay': { selector: pulseParamsSelector, attr: 'activationPhaseDuration_seconds' },
    Cooldown: { selector: pulseParamsSelector, attr: 'cooldownTimeSecs' },
  },
};

export default {
  csvFile: 'qed.datacore.csv',
  label: 'DC QEDs',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Jammer Range'],
  descKeyMatch: (kl) => kl.includes('descqdmp_') || kl.includes('descqed_'),
  getTargetKeys: makeGetTargetKeysFromPrefixMap([
    ['qdmp_', 'QDMP_'],
    ['qed_', 'QED_'],
    ['qig_', 'QDMP_'],
  ]),
  buildValue(r, flavorText, _oldValue, _targetKey, context) {
    const hasSnare = r['Interdiction Range'] && r['Interdiction Range'] !== '0';

    const s = stat(r)
      .line('Item Type', hasSnare ? 'Quantum Enforcement Device' : 'Quantum Dampener')
      .line('Manufacturer', dataCoreManufacturerDisplayName(r, context.localizationValue))
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
