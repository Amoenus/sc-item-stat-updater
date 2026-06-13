import type { ItemConfig } from '../../enrichment/item-config';
import { stat } from '../../enrichment/stat-builder';
import { isWeaponDescKey } from '../shared/weapon-matchers';
import { type DataCoreItemTypeConfig, makeGetTargetKeys, usableDataCoreLocalizationKey } from './types';

const ammoParamsRef = { selector: 'SAmmoContainerComponentParams', attr: 'ammoParamsRecord' };
const fireActionSelector =
  'SCItemWeaponComponentParams SWeaponActionFireSingleParams, SCItemWeaponComponentParams SWeaponActionFireRapidParams';
const fallbackTargetKeys = makeGetTargetKeys('mgun_', 'MGUN_');

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/ships/weapons',
  recordSelector: 'SAttachableComponentParams AttachDef[Type="WeaponGun"]',
  entityClassPrefix: 'mgun_',
  nameKeyInfix: 'MGUN_',
  fieldSelectors: {
    'Damage Alpha': {
      ref: ammoParamsRef,
      selector: 'DamageInfo',
      attrs: ['DamagePhysical', 'DamageEnergy', 'DamageDistortion', 'DamageThermal', 'DamageBiochemical', 'DamageStun'],
      format: 'sum',
    },
    'Rate of Fire': { selector: fireActionSelector, attr: 'fireRate' },
    'Projectile Speed': { ref: ammoParamsRef, selector: ':root', attr: 'speed' },
    'Ammo Range': { ref: ammoParamsRef, selector: ':root', attrs: ['speed', 'lifetime'], format: 'product' },
    'Ammo Quantity': { selector: 'SAmmoContainerComponentParams', attr: 'maxAmmoCount' },
    'Heat Per Shot': { selector: fireActionSelector, attr: 'heatPerShot' },
  },
};

export default {
  csvFile: 'weapongun.datacore.csv',
  label: 'DC Weapon Guns',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Damage Alpha', 'Rate of Fire', 'Health'],
  descKeyMatch: isWeaponDescKey,
  getTargetKeys(row, deriveDescKey) {
    const descriptionKey = usableDataCoreLocalizationKey(row['Description Key']);

    if (descriptionKey) {
      return [/^item_Name/i.test(descriptionKey) ? deriveDescKey(descriptionKey) : descriptionKey];
    }

    return fallbackTargetKeys(row, deriveDescKey);
  },
  buildValue(r, flavorText) {
    const hasAmmo = r['Ammo Quantity'] && r['Ammo Quantity'] !== '0' && r['Ammo Quantity'] !== '';

    const s = stat(r)
      .line('Item Type', r['Type'] || 'Vehicle Gun')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .section('-- Combat Stats --')
      .raw('Alpha Damage', 'Damage Alpha')
      .raw('Rate of Fire', 'Rate of Fire', ' RPM')
      .rawIf('Projectile Speed', 'Projectile Speed', ' m/s')
      .rawIf('Range', 'Ammo Range', 'm');

    if (hasAmmo) {
      s.section('-- Ammo --').raw('Ammo Count', 'Ammo Quantity');
    }

    s.section('-- Heat --');
    if (r['Heat Per Shot'] && r['Heat Per Shot'] !== '0') s.raw('Heat Per Shot', 'Heat Per Shot');

    return s.section('-- Durability --').raw('Health', 'Health').build(flavorText);
  },
} satisfies ItemConfig;
