import { stat } from '../../enrichment/stat-builder';
import type { ItemConfig } from '../../enrichment/item-config';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

const fallbackTargetKeys = makeGetTargetKeys('powr_', 'POWR_');

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/powerplant',
  // powr_amrs_s1_heartbeat -> strip 'powr_' -> 'AMRS_S1_HEARTBEAT' -> item_NamePOWR_AMRS_S1_HEARTBEAT
  entityClassPrefix: 'powr_',
  nameKeyInfix: 'POWR_',
  fieldSelectors: {
    'Power Output': { selector: 'generation[resource="Power"] SPowerSegmentResourceUnit', attr: 'units' },
    'Cooling Usage': {
      selector: 'consumption[resource="Coolant"] SStandardResourceUnit',
      attr: 'standardResourceUnits',
    },
    'EM Signature': { selector: 'ItemResourceState signatureParams EMSignature', attr: 'nominalSignature' },
    'EM Signature Decay': { selector: 'ItemResourceState signatureParams EMSignature', attr: 'decayRate' },
    'IR Signature': { selector: 'ItemResourceState signatureParams IRSignature', attr: 'nominalSignature' },
    'IR Signature Decay': { selector: 'ItemResourceState signatureParams IRSignature', attr: 'decayRate' },
    'Temperature to IR': { selector: 'temperature signatureParams', attr: 'temperatureToIR' },
    'Minimum Temperature for IR': { selector: 'temperature signatureParams', attr: 'minimumTemperatureForIR' },
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

function getPowerPlantAlternateDescKeys(descKey: string): string[] {
  const altKeys = new Set<string>();
  const candidates = [descKey];
  if (/_SCItem$/i.test(descKey)) {
    candidates.push(descKey.replace(/_SCItem$/i, ''));
  } else {
    candidates.push(`${descKey}_SCItem`);
  }
  for (const candidate of candidates) {
    altKeys.add(candidate);
    if (candidate.includes('item_Desc_POWR_')) {
      altKeys.add(candidate.replace('item_Desc_POWR_', 'item_DescPOWR_'));
    }
    if (candidate.includes('item_DescPOWR_')) {
      altKeys.add(candidate.replace('item_DescPOWR_', 'item_Desc_POWR_'));
    }
  }
  altKeys.delete(descKey);
  return [...altKeys];
}

export default {
  csvFile: 'powerplant.datacore.csv',
  label: 'DC Power Plants',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Grade', 'Power Output', 'Health'],
  descKeyMatch: (kl) => kl.includes('descpowr_') || kl.includes('desc_powr_'),
  getAlternateDescKeys: getPowerPlantAlternateDescKeys,
  getTargetKeys(row, deriveDescKey) {
    return fallbackTargetKeys(row, deriveDescKey).flatMap((key) => [key, ...getPowerPlantAlternateDescKeys(key)]);
  },
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Power Plant')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Grade', 'Grade')
      .lineIf('Class', r['Class'])
      .section('-- Power Stats --')
      .raw('Power Output', 'Power Output')
      .rawIf('Cooling Usage', 'Cooling Usage')
      .section('-- Signatures --')
      .rawIf('EM', 'EM Signature')
      .rawIf('EM Decay', 'EM Signature Decay')
      .rawIf('IR', 'IR Signature')
      .rawIf('IR Decay', 'IR Signature Decay')
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
