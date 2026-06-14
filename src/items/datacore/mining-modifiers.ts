import type { ItemConfig } from '../../enrichment/item-config';
import { dataCoreManufacturerDisplayName } from './manufacturer-display';
import { stat } from '../../enrichment/stat-builder';
import { type DataCoreItemTypeConfig, resolvePatchableDataCoreDescriptionTargets } from './types';

// Formats a raw damageMultiplier (e.g. 1.35 → '+35%', 0.85 → '-15%').
function fmtPowerModifier(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0 || n === 1) return '';
  const pct = Number(((n - 1) * 100).toFixed(1));
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

// Formats a raw percentage delta (e.g. 15.5 → '+15.5%', -30 → '-30%').
function fmtModifier(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '';
  return n > 0 ? `+${n}%` : `${n}%`;
}

export const DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig = {
  // Verified against real unforged XML cache. Entity files live at:
  //   libs/foundry/records/entities/scitem/ships/utility/mining/miningarm/
  // Passive modules: activationMethod="ActivateOnAttach", charges="1"
  // Active/consumable modules: activationMethod="ActivateOnDemand", charges=N
  recordFilter: 'scitem/ships/utility/mining/miningarm/mining_modules',
  // Entity classes are mining_modules_* (passive/active) or mining_modules_vehiclemod_*
  // The raw DataCore localization key from the Localization tag is used directly;
  // the prefix/infix fallback is rarely needed for these items.
  entityClassPrefix: 'mining_modules_',
  nameKeyInfix: 'MINING_MODULES_',
  fieldSelectors: {
    // Type: derived from size (size 2 = Gadget, otherwise Module)
    Type: {
      derive: (row) => (row['Size'] === '2' ? 'Gadget' : 'Module'),
    },
    // Charges: from EntityComponentAttachableModifierParams attribute
    // (0 = permanent built-in, 1 = passive/permanent module, N = consumable)
    Charges: {
      selector: 'EntityComponentAttachableModifierParams',
      attr: 'charges',
    },
    // Duration: from ItemMiningModifierParams modifierLifetime (consumables only)
    Duration: {
      selector: 'ItemMiningModifierParams modifierLifetime ItemModifierTimedLife',
      attr: 'lifetime',
    },
    // Power modifier for mining beam (fire action 0) — raw damageMultiplier
    // e.g. 1.35 = +35%, 0.85 = -15%; formatted in buildValue via fmtPowerModifier
    'Power Modifier Mining': {
      selector: 'ItemWeaponModifiersParams[fireActionIndex="0"] weaponStats',
      attr: 'damageMultiplier',
    },
    // Power modifier for extraction beam (fire action 1) — raw damageMultiplier
    'Power Modifier Extract': {
      selector: 'ItemWeaponModifiersParams[fireActionIndex="1"] weaponStats',
      attr: 'damageMultiplier',
    },
    // Rock modifiers — raw integer/decimal percentage delta values
    // (e.g. value="15.5" = +15.5%, value="-30" = -30%)
    Resistance: {
      selector: 'ItemMiningModifierParams MiningLaserModifier resistanceModifier FloatModifierMultiplicative',
      attr: 'value',
    },
    Instability: {
      selector: 'ItemMiningModifierParams MiningLaserModifier laserInstability FloatModifierMultiplicative',
      attr: 'value',
    },
    'Optimal Charge Zone': {
      selector:
        'ItemMiningModifierParams MiningLaserModifier optimalChargeWindowSizeModifier FloatModifierMultiplicative',
      attr: 'value',
    },
    'Optimal Rate': {
      selector:
        'ItemMiningModifierParams MiningLaserModifier optimalChargeWindowRateModifier FloatModifierMultiplicative',
      attr: 'value',
    },
    'Shatter Damage': {
      selector: 'ItemMiningModifierParams MiningLaserModifier shatterdamageModifier FloatModifierMultiplicative',
      attr: 'value',
    },
    'Cluster Factor': {
      selector: 'ItemMiningModifierParams MiningLaserModifier clusterFactor FloatModifierMultiplicative',
      attr: 'value',
    },
    // Note: the DataForge element is catastrophicChargeWindowRateModifier;
    // SPViewer labels this "Overcharge Rate" (charge rate beyond optimal window).
    'Overcharge Rate': {
      selector:
        'ItemMiningModifierParams MiningLaserModifier catastrophicChargeWindowRateModifier FloatModifierMultiplicative',
      attr: 'value',
    },
    // Filter modifier — stored in MiningFilterItemModifierParams (separate from MiningLaserModifier).
    // Raw value is positive (e.g. 20 = filter out 20% more inert material from ore).
    'Inert Materials': {
      selector: 'MiningFilterItemModifierParams filterParams filterModifier FloatModifierMultiplicative',
      attr: 'value',
    },
  },
};

export default {
  csvFile: 'miningmodifier.datacore.csv',
  label: 'DC Mining Modifiers',
  requiredColumns: ['Entity Class', 'Manufacturer', 'Size'],
  descKeyMatch: (kl) =>
    (kl.startsWith('item_mining_consumable_') && kl.endsWith('_desc')) ||
    (kl.startsWith('item_mining_gadget_') && kl.endsWith('_desc')) ||
    (kl.startsWith('item_mining_modules_') && kl.endsWith('_desc')) ||
    (kl.startsWith('item_mining_') && kl.endsWith('_desc')),
  nameKeyToDescKey: (nameKey) => (nameKey.endsWith('_Name') ? nameKey.replace(/_Name$/, '_Desc') : `${nameKey}_Desc`),
  getTargetKeys(row, deriveDescKey) {
    return resolvePatchableDataCoreDescriptionTargets(row, deriveDescKey);
  },
  buildValue(r, flavorText, _oldValue, _targetKey, context) {
    const charges = Number(r['Charges']);
    const showCharges = Number.isFinite(charges) && charges > 1;
    const duration = r['Duration'];

    return stat(r)
      .line('Item Type', r['Type'] || 'Mining Modifier')
      .line('Manufacturer', dataCoreManufacturerDisplayName(r, context.localizationValue))
      .raw('Size', 'Size')
      .lineIf('Charges', showCharges ? String(charges) : '')
      .lineIf('Duration', duration ? `${duration}s` : '')
      .section('-- Power Modifiers --')
      .lineIf('Power Mining', fmtPowerModifier(r['Power Modifier Mining']))
      .lineIf('Power Extract', fmtPowerModifier(r['Power Modifier Extract']))
      .section('-- Rock Modifiers --')
      .lineIf('Resistance', fmtModifier(r['Resistance']))
      .lineIf('Instability', fmtModifier(r['Instability']))
      .lineIf('Optimal Charge Zone', fmtModifier(r['Optimal Charge Zone']))
      .lineIf('Optimal Rate', fmtModifier(r['Optimal Rate']))
      .lineIf('Shatter Damage', fmtModifier(r['Shatter Damage']))
      .lineIf('Cluster Factor', fmtModifier(r['Cluster Factor']))
      .lineIf('Overcharge Rate', fmtModifier(r['Overcharge Rate']))
      .lineIf('Inert Materials', fmtModifier(r['Inert Materials']))
      .build(flavorText);
  },
} satisfies ItemConfig;
