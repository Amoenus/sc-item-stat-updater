import type { ItemConfig } from '../../enrichment/item-config';
import { stat } from '../../enrichment/stat-builder';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

const ammoParamsRef = {
  selector: 'SAmmoContainerComponentParams',
  attr: 'ammoParamsRecord',
  graphAttribute: 'ammoParamsRecord',
};
const countermeasureParamsSelector = 'CounterMeasureChaffParams, CounterMeasureFlareParams';

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/countermeasures',
  recordSelector: 'SAmmoContainerComponentParams',
  includeStructuralDiscovery: false,
  entityClassPrefix: '',
  nameKeyInfix: '',
  fieldSelectors: {
    Type: {
      derive: (row) => {
        const entityClass = row['Entity Class'].toLowerCase();
        if (entityClass.includes('chaff')) return 'Chaff';
        if (entityClass.includes('noise')) return 'Noise';
        if (entityClass.includes('flare') || entityClass.includes('decoy')) return 'Decoy';
        return row['Class'] || 'Countermeasure';
      },
    },
    'Ammo Quantity': { selector: 'SAmmoContainerComponentParams', attr: 'maxAmmoCount' },
    'Ammo Speed': { ref: ammoParamsRef, selector: ':root', attr: 'speed' },
    'Ammo Lifetime': { ref: ammoParamsRef, selector: ':root', attr: 'lifetime' },
    'Signature IR': { ref: ammoParamsRef, selector: countermeasureParamsSelector, attr: 'StartInfrared' },
    'Signature CS': { ref: ammoParamsRef, selector: countermeasureParamsSelector, attr: 'StartCrossSection' },
    'Signature EM': { ref: ammoParamsRef, selector: countermeasureParamsSelector, attr: 'StartElectromagnetic' },
  },
};

export default {
  csvFile: 'weapondefensive.datacore.csv',
  label: 'DC Defensive Weapons',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Health'],
  descKeyMatch: (kl) =>
    kl.includes('desc') &&
    (kl.includes('chaff') || kl.includes('flare') || kl.includes('noise') || kl.includes('countermeasure')),
  getTargetKeys: makeGetTargetKeys('', ''),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', r['Type'] || 'Defensive Weapon')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Ammo --')
      .rawIf('Quantity', 'Ammo Quantity')
      .rawIf('Speed', 'Ammo Speed')
      .rawIf('Lifetime', 'Ammo Lifetime')
      .section('-- Signatures --')
      .rawIf('IR', 'Signature IR')
      .rawIf('CS', 'Signature CS')
      .rawIf('EM', 'Signature EM')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
