import type { ItemConfig } from '../../enrichment/item-config';
import { stat } from '../../enrichment/stat-builder';
import { dataCoreManufacturerDisplayName } from './manufacturer-display';
import {
  addAlternateDescKeysWhenDataCoreLacksDescription,
  type DataCoreItemTypeConfig,
  makeAlternateDataCoreDescKeys,
  makeGetTargetKeys,
} from './types';

const fallbackTargetKeys = makeGetTargetKeys('cool_', 'COOL_');
const getCoolerAlternateDescKeys = makeAlternateDataCoreDescKeys('COOL', { includeScItemAlias: true });

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/cooler',
  // cool_acom_s01_iceplunge -> strip 'cool_' -> 'ACOM_S01_ICEPLUNGE' -> item_NameCOOL_ACOM_S01_ICEPLUNGE
  entityClassPrefix: 'cool_',
  nameKeyInfix: 'COOL_',
  fieldSelectors: {
    'Cooling Rate': {
      selector: 'generation[resource="Coolant"] SStandardResourceUnit',
      attr: 'standardResourceUnits',
    },
    'Power Usage': { selector: 'consumption[resource="Power"] SPowerSegmentResourceUnit', attr: 'units' },
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

export default {
  csvFile: 'cooler.datacore.csv',
  label: 'DC Coolers',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Grade', 'Cooling Rate', 'Health'],
  descKeyMatch: (kl) => kl.includes('desccool_') || kl.includes('desc_cool_'),
  // Coolers use an irregular nameKey -> descKey mapping: item_Name_COOL_ <-> item_Desc_COOL_
  nameKeyToDescKey(nameKey) {
    return nameKey.replace(/(item_)(Name|name|NAME)_?(?=COOL_)/i, '$1Desc_');
  },
  getAlternateDescKeys: getCoolerAlternateDescKeys,
  getTargetKeys(row, deriveDescKey) {
    return addAlternateDescKeysWhenDataCoreLacksDescription(
      row,
      fallbackTargetKeys(row, deriveDescKey),
      getCoolerAlternateDescKeys,
    );
  },
  buildValue(r, flavorText, _oldValue, _targetKey, context) {
    return stat(r)
      .line('Item Type', 'Cooler')
      .line('Manufacturer', dataCoreManufacturerDisplayName(r, context.localizationValue))
      .raw('Size', 'Size')
      .raw('Grade', 'Grade')
      .lineIf('Class', r['Class'])
      .section('-- Cooling Stats --')
      .raw('Cooling Rate', 'Cooling Rate')
      .rawIf('Power Usage', 'Power Usage')
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
