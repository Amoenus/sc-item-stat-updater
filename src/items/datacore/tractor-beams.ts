import type { ItemConfig } from '../../enrichment/item-config';
import { stat } from '../../enrichment/stat-builder';
import { type DataCoreItemTypeConfig, makeGetTargetKeys } from './types';

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: [
    'ships/weapons/argo_atls_tractorbeam',
    'ships/weapons/argo_towingbeam',
    'ships/weapons/grin_tractorbeam',
    'ships/weapons/wep_towingbeam',
    'ships/weapons/wep_tractorbeam',
  ],
  entityClassPrefix: 'grin_tractorbeam_',
  nameKeyInfix: 'GRIN_TRACTORBEAM_',
  fieldSelectors: {
    Force: {
      selector: 'SWeaponActionFireTractorBeamParams',
      attrs: ['minForce', 'maxForce'],
      format: 'scaled-number-pair',
      scale: 0.000001,
    },
    Range: {
      selector: 'SWeaponActionFireTractorBeamParams',
      attrs: ['minDistance', 'maxDistance'],
      format: 'number-pair',
    },
    'Full Strength Distance': {
      selector: 'SWeaponActionFireTractorBeamParams',
      attr: 'fullStrengthDistance',
    },
    'Max Angle': {
      selector: 'SWeaponActionFireTractorBeamParams',
      attr: 'maxAngle',
    },
    'Max Volume': {
      selector: 'SWeaponActionFireTractorBeamParams',
      attr: 'maxVolume',
    },
    'Tow Force': {
      selector: 'SWeaponActionFireTractorBeamTowingParams',
      attr: 'towingForce',
      format: 'scaled-number',
      scale: 0.000001,
    },
    'Tow Max Distance': {
      selector: 'SWeaponActionFireTractorBeamTowingParams',
      attr: 'towingMaxDistance',
    },
  },
};

export default {
  csvFile: 'tractorbeam.datacore.csv',
  label: 'DC Tractor Beams',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Force', 'Range', 'Health'],
  descKeyMatch: (kl) => kl.includes('desc') && kl.includes('tractorbeam'),
  getTargetKeys: makeGetTargetKeys('grin_tractorbeam_', 'GRIN_TRACTORBEAM_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Tractor Beam')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Tractor Stats --')
      .raw('Force', 'Force', ' MN')
      .raw('Range', 'Range')
      .rawIf('Full Strength Distance', 'Full Strength Distance')
      .rawIf('Max Angle', 'Max Angle')
      .rawIf('Max Volume', 'Max Volume')
      .section('-- Towing --')
      .rawIf('Tow Force', 'Tow Force', ' MN')
      .rawIf('Tow Max Distance', 'Tow Max Distance')
      .section('-- Durability --')
      .raw('Health', 'Health')
      .build(flavorText);
  },
} satisfies ItemConfig;
