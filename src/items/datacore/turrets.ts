import { stat } from '../../enrichment/stat-builder';
import type { ItemConfig } from '../../enrichment/item-config';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

const yawAxisSelector = 'SCItemTurretParams yawAxis SCItemTurretJointMovementAxisParams';
const pitchAxisSelector = 'SCItemTurretParams pitchAxis SCItemTurretJointMovementAxisParams';

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/turret',
  recordSelector: 'SCItemTurretParams',
  entityClassPrefix: 'turr_',
  nameKeyInfix: 'TURR_',
  fieldSelectors: {
    'Yaw Speed': { selector: yawAxisSelector, attr: 'speed' },
    'Yaw Time To Full Speed': { selector: yawAxisSelector, attr: 'acceleration_timeToFullSpeed' },
    'Yaw Accel Decay': { selector: yawAxisSelector, attr: 'accelerationDecay' },
    'Pitch Speed': { selector: pitchAxisSelector, attr: 'speed' },
    'Pitch Time To Full Speed': { selector: pitchAxisSelector, attr: 'acceleration_timeToFullSpeed' },
    'Pitch Accel Decay': { selector: pitchAxisSelector, attr: 'accelerationDecay' },
  },
};

export default {
  csvFile: 'turret.datacore.csv',
  label: 'DC Turrets',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Health'],
  descKeyMatch: (kl) => kl.includes('desc') && kl.includes('turret'),
  getTargetKeys: makeGetTargetKeys('turr_', 'TURR_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Turret')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Rotation --')
      .rawIf('Yaw Speed', 'Yaw Speed')
      .rawIf('Yaw Time To Full Speed', 'Yaw Time To Full Speed')
      .rawIf('Yaw Accel Decay', 'Yaw Accel Decay')
      .rawIf('Pitch Speed', 'Pitch Speed')
      .rawIf('Pitch Time To Full Speed', 'Pitch Time To Full Speed')
      .rawIf('Pitch Accel Decay', 'Pitch Accel Decay')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
