import type { ItemConfig } from '../../enrichment/item-config';
import { dataCoreManufacturerDisplayName } from './manufacturer-display';
import { stat } from '../../enrichment/stat-builder';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/jumpdrive',
  // jdrv_orig_s3_holvn -> strip 'jdrv_' -> 'ORIG_S3_HOLVN' -> item_NameJDRV_ORIG_S3_HOLVN
  entityClassPrefix: 'jdrv_',
  nameKeyInfix: 'JDRV_',
  fieldSelectors: {
    'Alignment Rate': { selector: 'SCItemJumpDriveParams', attr: 'alignmentRate' },
    'Alignment Decay': { selector: 'SCItemJumpDriveParams', attr: 'alignmentDecayRate' },
    'Tuning Rate': { selector: 'SCItemJumpDriveParams', attr: 'tuningRate' },
    'Tuning Decay': { selector: 'SCItemJumpDriveParams', attr: 'tuningDecayRate' },
    'Fuel Usage Mult': { selector: 'SCItemJumpDriveParams', attr: 'fuelUsageEfficiencyMultiplier' },
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

export default {
  csvFile: 'jumpdrive.datacore.csv',
  label: 'DC Jump Drives',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Grade', 'Health'],
  descKeyMatch: (kl) => kl.includes('desc') && kl.includes('jdrv'),
  getTargetKeys: makeGetTargetKeys('jdrv_', 'JDRV_'),
  buildValue(r, flavorText, _oldValue, _targetKey, context) {
    return stat(r)
      .line('Item Type', 'Jump Drive')
      .line('Manufacturer', dataCoreManufacturerDisplayName(r, context.localizationValue))
      .raw('Size', 'Size')
      .raw('Grade', 'Grade')
      .lineIf('Class', r['Class'])
      .section('-- Jump Drive Stats --')
      .rawIf('Alignment Rate', 'Alignment Rate')
      .rawIf('Alignment Decay', 'Alignment Decay')
      .rawIf('Tuning Rate', 'Tuning Rate')
      .rawIf('Tuning Decay', 'Tuning Decay')
      .rawIf('Fuel Usage Mult', 'Fuel Usage Mult')
      .section('-- Distortion --')
      .rawIf('Shutdown Damage', 'Distortion Shutdown Damage')
      .rawIf('Decay Delay', 'Distortion Decay Delay')
      .rawIf('Decay Rate', 'Distortion Decay Rate')
      .rawIf('Shutdown Time', 'Distortion Shutdown Time')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
