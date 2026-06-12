import { readCsvFile } from '../../io/local/csv-parser';
import { resolveChildPath } from '../../io/local/path-conventions';
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
const newline = String.raw`\n`;
const knifeDisplaySizeByFamily: Array<[RegExp, string]> = [
  [/^apar_melee_/i, '15 cm'],
  [/^banu_melee_02$/i, 'N/A'],
  [/^none_melee_/i, 'N/A'],
  [/_melee_/i, '16 cm'],
];

function isMeleeKnife(row: Record<string, string>): boolean {
  return row['Class'].toLowerCase() === 'knife' || /_melee_/i.test(row['Entity Class']);
}

function isPortableLight(row: Record<string, string>, targetKey: string): boolean {
  const haystack = [row['Entity Class'], row['Name Key'], row['Description Key'], targetKey].join(' ');
  return /(?:portable_light|glowstick|flare)/i.test(haystack);
}

function isThrowableWeaponPersonal(row: Record<string, string>): boolean {
  const haystack = [row['Entity Class'], row['Name Key'], row['Description Key'], row.Class].join(' ');
  return /(?:grenade|_gren_|throwable)/i.test(haystack);
}

function getManufacturerDisplayName(row: Record<string, string>, localizationValue: (key: string) => string): string {
  const manufacturerName = row['Manufacturer Name Key']
    ? localizationValue(row['Manufacturer Name Key'])
    : row['Manufacturer'];
  return manufacturerName || row['Manufacturer'] || 'Unknown';
}

function extractExistingDisplaySize(oldValue: string): string {
  const match = /(?:^|\\n)Size:\s*([^\\]+?)(?=\\n|$)/i.exec(oldValue);
  const size = match?.[1]?.trim() ?? '';
  return size && size !== '1' ? size : '';
}

function fallbackKnifeDisplaySize(entityClass: string): string {
  return knifeDisplaySizeByFamily.find(([pattern]) => pattern.test(entityClass))?.[1] ?? '';
}

function buildMeleeKnifeValue(
  row: Record<string, string>,
  flavorText: string,
  oldValue: string,
  localizationValue: (key: string) => string,
): string {
  const manufacturer = getManufacturerDisplayName(row, localizationValue);
  const size = extractExistingDisplaySize(oldValue) || fallbackKnifeDisplaySize(row['Entity Class']);

  const lines = [
    `Manufacturer: ${manufacturer}`,
    `Item Type: ${row['Class'] || 'Knife'}`,
    'Class: Melee',
    '',
    `Size: ${size || 'N/A'}`,
  ];
  return `${lines.join(newline)}${flavorText ? `${newline}${newline}${flavorText}` : ''}`;
}

function buildPortableLightValue(
  row: Record<string, string>,
  flavorText: string,
  localizationValue: (key: string) => string,
): string {
  const manufacturer = getManufacturerDisplayName(row, localizationValue);
  return `Manufacturer: ${manufacturer}${flavorText ? `${newline}${newline}${flavorText}` : ''}`;
}

export async function loadPersonalWeaponSourceData(context: {
  csvDir: string;
}): Promise<Array<Record<string, string>>> {
  const [weaponRows, manufacturerRows] = await Promise.all([
    readCsvFile(resolveChildPath(context.csvDir, 'weaponpersonal.datacore.csv', 'personal weapon CSV filename')),
    readCsvFile(resolveChildPath(context.csvDir, 'manufacturers.datacore.csv', 'manufacturer CSV filename')),
  ]);
  const manufacturerNameKeysByGuid = new Map<string, string>(
    manufacturerRows.flatMap((row) =>
      row['Record GUID'] && row['Name Key'] ? ([[row['Record GUID'], row['Name Key']] as const] as const) : [],
    ),
  );
  const manufacturerNameKeysByCode = new Map<string, string>(
    manufacturerRows.flatMap((row) =>
      row['Code'] && row['Name Key'] ? ([[row['Code'], row['Name Key']] as const] as const) : [],
    ),
  );

  return weaponRows.map((row) => ({
    ...row,
    'Manufacturer Name Key':
      manufacturerNameKeysByGuid.get(row['Manufacturer GUID']) ?? manufacturerNameKeysByCode.get(row['Manufacturer']) ?? '',
  }));
}

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
  excludeRow: isThrowableWeaponPersonal,
};

export default {
  csvFile: 'weaponpersonal.datacore.csv',
  sourceFiles: [{ file: 'weaponpersonal.datacore.csv' }, { file: 'manufacturers.datacore.csv' }],
  loadSourceData: loadPersonalWeaponSourceData,
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
      !kl.includes('grenade') &&
      !kl.includes('_gren_') &&
      !kl.includes('throwable') &&
      !kl.includes('optics') &&
      !kl.includes('barrel')),
  getTargetKeys: (row, deriveDescKey) => (isThrowableWeaponPersonal(row) ? [] : getRawDataCoreTargetKeys(row, deriveDescKey)),
  buildValue(r, flavorText, oldValue, targetKey, context) {
    if (isMeleeKnife(r)) {
      return buildMeleeKnifeValue(r, flavorText, oldValue, context.localizationValue);
    }
    if (isPortableLight(r, targetKey)) {
      return buildPortableLightValue(r, flavorText, context.localizationValue);
    }

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
