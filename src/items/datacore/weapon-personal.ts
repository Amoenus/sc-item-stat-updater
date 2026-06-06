import type { ItemConfig } from '../../enrichment/item-config';
import { stat } from '../../enrichment/stat-builder';
import { type DataCoreItemTypeConfig, getRawDataCoreTargetKeys } from './types';

const defaultMagazineRef = {
  selector: 'SEntityComponentDefaultLoadoutParams SItemPortLoadoutEntryParams[itemPortName="magazine_attach"]',
  attr: 'entityClassName',
  by: 'entityClass' as const,
  fallback: {
    selector: 'SEntityComponentDefaultLoadoutParams SItemPortLoadoutEntryParams[itemPortName="magazine_attach"]',
    attr: 'entityClassReference',
  },
};
const defaultMagazineAmmoRef = [
  defaultMagazineRef,
  { selector: 'SAmmoContainerComponentParams', attr: 'ammoParamsRecord' },
];
const fireActionSelector =
  'SCItemWeaponComponentParams SWeaponActionFireSingleParams, SCItemWeaponComponentParams SWeaponActionFireRapidParams';

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  recordFilter: 'scitem/weapons/fps_weapons',
  recordSelector: 'SAttachableComponentParams AttachDef[Type="WeaponPersonal"]',
  entityClassPrefix: '',
  nameKeyInfix: '',
  fieldSelectors: {
    'Damage Alpha': {
      ref: defaultMagazineAmmoRef,
      selector: 'DamageInfo',
      attrs: ['DamagePhysical', 'DamageEnergy', 'DamageDistortion', 'DamageThermal', 'DamageBiochemical', 'DamageStun'],
      format: 'sum',
    },
    'Rate of Fire': { selector: fireActionSelector, attr: 'fireRate' },
    'Fire Mode': { selector: fireActionSelector, attr: 'aiShootingMode' },
    'Projectile Speed': { ref: defaultMagazineAmmoRef, selector: ':root', attr: 'speed' },
    'Ammo Range': { ref: defaultMagazineAmmoRef, selector: ':root', attrs: ['speed', 'lifetime'], format: 'product' },
    'Ammo Quantity': { ref: defaultMagazineRef, selector: 'SAmmoContainerComponentParams', attr: 'maxAmmoCount' },
  },
};

export default {
  csvFile: 'weaponpersonal.datacore.csv',
  label: 'DC Personal Weapons',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size', 'Damage Alpha', 'Rate of Fire'],
  descKeyMatch: (kl) =>
    (kl.includes('desc') &&
      (kl.includes('_pistol') ||
        kl.includes('_smg') ||
        kl.includes('_rifle') ||
        kl.includes('_sniper') ||
        kl.includes('_shotgun') ||
        kl.includes('_lmg'))) ||
    ((kl.includes('descgmni_') || kl.includes('descbehr_') || kl.includes('descklwe_') || kl.includes('descksar_')) &&
      !kl.includes('optics') &&
      !kl.includes('barrel')),
  getTargetKeys: (row, deriveDescKey) => getRawDataCoreTargetKeys(row, deriveDescKey),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', r['Type'] || 'Personal Weapon')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .rawIf('Fire Mode', 'Fire Mode')
      .section('-- Damage --')
      .raw('Alpha Damage', 'Damage Alpha')
      .raw('Rate of Fire', 'Rate of Fire', ' RPM')
      .section('-- Ballistics --')
      .rawIf('Speed', 'Projectile Speed', ' m/s')
      .rawIf('Range', 'Ammo Range', 'm')
      .rawIf('Ammo', 'Ammo Quantity')
      .build(flavorText);
  },
} satisfies ItemConfig;
