import type { ItemConfig } from '../../enrichment/item-config';
import { stat } from '../../enrichment/stat-builder';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

const radarSignatureSelector = 'SCItemRadarComponentParams signatureDetection SCItemRadarSignatureDetection';

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/radar',
  // rdar_orig_s1_scan -> strip 'rdar_' -> 'ORIG_S1_SCAN' -> item_NameRADR_ORIG_S1_SCAN
  entityClassPrefix: 'rdar_',
  nameKeyInfix: 'RADR_',
  fieldSelectors: {
    'Aim Assist Distance (PiP) Min': {
      selector: 'SCItemRadarComponentParams aimAssist',
      attr: 'distanceMinAssignment',
    },
    'Aim Assist Distance (PiP) Max': {
      selector: 'SCItemRadarComponentParams aimAssist',
      attr: 'distanceMaxAssignment',
    },
    'Aim Assist Distance (PiP) Buffer': {
      selector: 'SCItemRadarComponentParams aimAssist',
      attr: 'outsideRangeBufferDistance',
    },
    'Sensitivity IR': { selector: radarSignatureSelector, index: 0, attr: 'sensitivity' },
    'Sensitivity CS': { selector: radarSignatureSelector, index: 1, attr: 'sensitivity' },
    'Sensitivity EM': { selector: radarSignatureSelector, index: 2, attr: 'sensitivity' },
    'Sensitivity RS': { selector: radarSignatureSelector, index: 4, attr: 'sensitivity' },
    'Sensitivity dB': { selector: radarSignatureSelector, index: 3, attr: 'sensitivity' },
    'Piercing IR': { selector: radarSignatureSelector, index: 0, attr: 'piercing' },
    'Piercing CS': { selector: radarSignatureSelector, index: 1, attr: 'piercing' },
    'Piercing EM': { selector: radarSignatureSelector, index: 2, attr: 'piercing' },
    'Piercing RS': { selector: radarSignatureSelector, index: 4, attr: 'piercing' },
    'Piercing dB': { selector: radarSignatureSelector, index: 3, attr: 'piercing' },
    'Temperature to IR': { selector: 'signatureParams', attr: 'temperatureToIR' },
    'Minimum Temperature for IR': { selector: 'signatureParams', attr: 'minimumTemperatureForIR' },
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
  csvFile: 'radar.datacore.csv',
  label: 'DC Radars',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Grade', 'Health'],
  descKeyMatch: (kl) => kl.includes('desc_radr_') || kl.includes('descradr_'),
  getTargetKeys: makeGetTargetKeys('rdar_', 'RADR_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Radar')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Grade', 'Grade')
      .lineIf('Class', r['Class'])
      .section('-- Aim Assist (PiP) --')
      .rawIf('Min', 'Aim Assist Distance (PiP) Min')
      .rawIf('Max', 'Aim Assist Distance (PiP) Max')
      .rawIf('Buffer', 'Aim Assist Distance (PiP) Buffer')
      .section('-- Sensitivity --')
      .rawIf('IR', 'Sensitivity IR')
      .rawIf('CS', 'Sensitivity CS')
      .rawIf('EM', 'Sensitivity EM')
      .rawIf('RS', 'Sensitivity RS')
      .rawIf('dB', 'Sensitivity dB')
      .section('-- Piercing --')
      .rawIf('IR', 'Piercing IR')
      .rawIf('CS', 'Piercing CS')
      .rawIf('EM', 'Piercing EM')
      .rawIf('RS', 'Piercing RS')
      .rawIf('dB', 'Piercing dB')
      .section('-- Signature Params --')
      .rawIf('Temperature to IR', 'Temperature to IR')
      .rawIf('Minimum Temperature for IR', 'Minimum Temperature for IR')
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
