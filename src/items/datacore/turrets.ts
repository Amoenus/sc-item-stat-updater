import type { ItemConfig } from '../../enrichment/item-config';
import { stat } from '../../enrichment/stat-builder';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

const yawAxisSelector = 'SCItemTurretParams yawAxis SCItemTurretJointMovementAxisParams';
const pitchAxisSelector = 'SCItemTurretParams pitchAxis SCItemTurretJointMovementAxisParams';
const fallbackTargetKeys = makeGetTargetKeys('turr_', 'TURR_');

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: ['scitem/ships', 'scitem/vehicles/turret'],
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

function usableKey(value: string | undefined): string {
  const trimmed = value?.trim() ?? '';
  return trimmed && trimmed !== 'LOC_EMPTY' && trimmed !== 'LOC_UNINITIALIZED' ? trimmed : '';
}

export default {
  csvFile: 'turret.datacore.csv',
  label: 'DC Turrets',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Health'],
  descKeyMatch: (kl) => kl.includes('desc') && kl.includes('turret'),
  getTargetKeys(row, deriveDescKey) {
    const shortNameKey = usableKey(row['Short Name Key']);
    if (/^item_Desc/i.test(shortNameKey)) return [shortNameKey];

    const descriptionKey = usableKey(row['Description Key']);
    const nameKey = usableKey(row['Name Key']);
    if (nameKey) {
      const derivedDescriptionKey = deriveDescKey(nameKey);
      if (!descriptionKey || descriptionKey.toLowerCase() !== derivedDescriptionKey.toLowerCase()) {
        return [derivedDescriptionKey];
      }
    }

    return fallbackTargetKeys(row, deriveDescKey);
  },
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
