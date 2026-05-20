// @ts-check
import { z } from 'zod';

// ---------------------------------------------------------------------------
// crafting_items-*.json
// ---------------------------------------------------------------------------;


export const NameSchema = z.enum([
    "Burst",
    "Charge",
    "Damage Beam",
    "Rapid",
    "Sequence",
    "Shotgun",
    "Single",
]);
export type Name = z.infer<typeof NameSchema>;


export const DelayUnitSchema = z.enum([
    "RPM",
    "Seconds",
]);
export type DelayUnit = z.infer<typeof DelayUnitSchema>;


export const SequenceEntryTypeSchema = z.enum([
    "beam",
    "burst",
    "charged",
    "rapid",
    "sequence",
    "single",
]);
export type SequenceEntryType = z.infer<typeof SequenceEntryTypeSchema>;


export const SequenceModeSchema = z.enum([
    "Automatically",
    "Individually",
    "Looping",
]);
export type SequenceMode = z.infer<typeof SequenceModeSchema>;


export const AttachSubTypeSchema = z.enum([
    "Gun",
    "Heavy",
    "Helmet",
    "Light",
    "LightArmor",
    "Magazine",
    "Medium",
    "MidRangeRadar",
    "NoseMounted",
    "Personal",
    "Power",
    "Small",
    "UNDEFINED",
]);
export type AttachSubType = z.infer<typeof AttachSubTypeSchema>;


export const TypeSchema = z.enum([
    "Char_Armor_Arms",
    "Char_Armor_Backpack",
    "Char_Armor_Helmet",
    "Char_Armor_Legs",
    "Char_Armor_Torso",
    "Char_Armor_Undersuit",
    "Cooler",
    "DockingCollar",
    "Misc",
    "PowerPlant",
    "QuantumDrive",
    "Radar",
    "SalvageHead",
    "SalvageModifier",
    "Shield",
    "TractorBeam",
    "WeaponAttachment",
    "WeaponGun",
    "WeaponMining",
    "WeaponPersonal",
]);
export type Type = z.infer<typeof TypeSchema>;


export const HitTypeSchema = z.enum([
    "ElectricArc",
    "Extraction",
]);
export type HitType = z.infer<typeof HitTypeSchema>;


export const CategorySchema = z.enum([
    "Long",
    "Medium",
    "Short",
]);
export type Category = z.infer<typeof CategorySchema>;


export const ComponentClassSchema = z.enum([
    "Ballistic",
    "Civilian",
    "Competition",
    "Electron",
    "Energy",
    "Industrial",
    "Laser",
    "Military",
    "Stealth",
]);
export type ComponentClass = z.infer<typeof ComponentClassSchema>;


export const ItemTypeSchema = z.enum([
    "armor",
    "shipcomponent",
    "unknown",
    "weapon",
]);
export type ItemType = z.infer<typeof ItemTypeSchema>;


export const SignaturesPoolTypeSchema = z.enum([
    "Electromagnetic",
    "Infrared",
]);
export type SignaturesPoolType = z.infer<typeof SignaturesPoolTypeSchema>;

export const DamageSchema = z.object({
    physical: z.number(),
    energy: z.number(),
    distortion: z.number(),
    thermal: z.number(),
    biochemical: z.number(),
    stun: z.number(),
});
export type Damage = z.infer<typeof DamageSchema>;

export const DamageDropoffSchema = z.object({
    "minDistance": DamageSchema,
    "perMeter": DamageSchema,
    "minDamage": DamageSchema,
});
export type DamageDropoff = z.infer<typeof DamageDropoffSchema>;

export const BiochemicalSchema = z.object({
    multiplier: z.number(),
    threshold: z.number(),
});
export type Biochemical = z.infer<typeof BiochemicalSchema>;

export const RecoilSchema = z.object({
    yawMaxDeg: z.number(),
    pitchMaxDeg: z.number(),
    rollMaxDeg: z.number(),
    maxFireTime: z.number(),
    smoothTime: z.number(),
    decayStart: z.number(),
    minDecay: z.number(),
    maxDecay: z.number(),
});
export type Recoil = z.infer<typeof RecoilSchema>;

export const SpreadSchema = z.object({
    min: z.union([z.number(), z.null()]),
    max: z.union([z.number(), z.null()]),
    firstAttack: z.union([z.number(), z.null()]),
    attack: z.union([z.number(), z.null()]),
    decay: z.union([z.number(), z.null()]),
});
export type Spread = z.infer<typeof SpreadSchema>;

export const BeamSchema = z.object({
    "hitType": HitTypeSchema,
    fullDamageRange: z.number(),
    zeroDamageRange: z.number(),
    dps: z.number(),
});
export type Beam = z.infer<typeof BeamSchema>;

export const CombatRangeSchema = z.object({
    ideal: z.number(),
    max: z.number(),
    "category": CategorySchema,
});
export type CombatRange = z.infer<typeof CombatRangeSchema>;

export const RadiationResistanceSchema = z.object({
    capacity: z.number(),
    dissipationRate: z.number(),
});
export type RadiationResistance = z.infer<typeof RadiationResistanceSchema>;

export const TemperatureResistanceSchema = z.object({
    min: z.number(),
    max: z.number(),
});
export type TemperatureResistance = z.infer<typeof TemperatureResistanceSchema>;

export const MagazinePoolSchema = z.object({
    ammoCount: z.number(),
    initialAmmoCount: z.number(),
    maxRestockCount: z.number(),
});
export type MagazinePool = z.infer<typeof MagazinePoolSchema>;

export const ManufacturerSchema = z.object({
    name: z.string(),
    guid: z.string(),
});
export type Manufacturer = z.infer<typeof ManufacturerSchema>;

export const MetaSchema = z.object({
    totalItems: z.number(),
    weapons: z.number(),
    armor: z.number(),
    shipcomponents: z.number(),
    unknown: z.number(),
    unresolved: z.number(),
    withLootSources: z.number(),
});
export type Meta = z.infer<typeof MetaSchema>;

export const SignaturesPoolSchema = z.object({
    "type": SignaturesPoolTypeSchema,
    emission: z.number(),
    reductionWeighted: z.number(),
    reductionAbsolute: z.number(),
});
export type SignaturesPool = z.infer<typeof SignaturesPoolSchema>;

export const AmmoPoolSchema = z.object({
    speed: z.number(),
    lifetime: z.number(),
    "damage": DamageSchema,
    damageDropoff: z.union([DamageDropoffSchema, z.null()]),
});
export type AmmoPool = z.infer<typeof AmmoPoolSchema>;

export const DamageResistancePoolSchema = z.object({
    "physical": BiochemicalSchema,
    "energy": BiochemicalSchema,
    "distortion": BiochemicalSchema,
    "thermal": BiochemicalSchema,
    "biochemical": BiochemicalSchema,
    "stun": BiochemicalSchema,
    impactForce: z.number(),
});
export type DamageResistancePool = z.infer<typeof DamageResistancePoolSchema>;

export const SequenceEntrySchema = z.object({
    "name": NameSchema,
    fireRate: z.number(),
    heatPerShot: z.number(),
    wearPerShot: z.number(),
    "type": SequenceEntryTypeSchema,
    "spread": SpreadSchema,
    pelletCount: z.number(),
    ammoCost: z.number(),
    damageMultiplier: z.number(),
    recoil: z.union([RecoilSchema, z.null()]),
    delay: z.number(),
    "delayUnit": DelayUnitSchema,
    repetitions: z.number(),
    shotCount: z.number().optional(),
    cooldownTime: z.number().optional(),
});
export type SequenceEntry = z.infer<typeof SequenceEntrySchema>;

export const ShieldSchema = z.object({
    "physical": TemperatureResistanceSchema,
    "energy": TemperatureResistanceSchema,
    "distortion": TemperatureResistanceSchema,
    "thermal": TemperatureResistanceSchema,
    "biochemical": TemperatureResistanceSchema,
    "stun": TemperatureResistanceSchema,
});
export type Shield = z.infer<typeof ShieldSchema>;

export const FireModesPoolSchema = z.object({
    name: z.union([NameSchema, z.null()]),
    "type": SequenceEntryTypeSchema,
    "sequenceMode": SequenceModeSchema.optional(),
    sequenceEntries: z.array(SequenceEntrySchema).optional(),
    fireRate: z.union([z.number(), z.null()]).optional(),
    heatPerShot: z.union([z.number(), z.null()]).optional(),
    wearPerShot: z.union([z.number(), z.null()]).optional(),
    "spread": SpreadSchema.optional(),
    pelletCount: z.number().optional(),
    ammoCost: z.number().optional(),
    damageMultiplier: z.number().optional(),
    recoil: z.union([RecoilSchema, z.null()]).optional(),
    shotCount: z.number().optional(),
    cooldownTime: z.number().optional(),
    chargeTime: z.number().optional(),
    overchargeTime: z.number().optional(),
});
export type FireModesPool = z.infer<typeof FireModesPoolSchema>;

export const ItemSchema = z.object({
    entityClass: z.string(),
    "itemType": ItemTypeSchema,
    "attachType": TypeSchema,
    "attachSubType": AttachSubTypeSchema,
    size: z.number(),
    grade: z.number(),
    tags: z.string(),
    manufacturer: z.union([z.null(), z.string()]),
    manufacturerCode: z.union([z.null(), z.string()]),
    mass: z.number(),
    "combatRange": CombatRangeSchema.optional(),
    name: z.union([z.null(), z.string()]),
    "cgItemType": TypeSchema,
    fireModesIndex: z.number().optional(),
    ammoIndex: z.number().optional(),
    magazineIndex: z.number().optional(),
    "componentClass": ComponentClassSchema.optional(),
    "temperatureResistance": TemperatureResistanceSchema.optional(),
    "radiationResistance": RadiationResistanceSchema.optional(),
    damageResistanceIndex: z.number().optional(),
    signaturesIndex: z.number().optional(),
    correctedName: z.string().optional(),
    health: z.number().optional(),
    selfRepairTime: z.number().optional(),
    emSignature: z.number().optional(),
    powerDraw: z.number().optional(),
    shieldHealth: z.number().optional(),
    shieldRegen: z.number().optional(),
    downedRegenDelay: z.number().optional(),
    damagedRegenDelay: z.number().optional(),
    "shieldResistance": ShieldSchema.optional(),
    "shieldAbsorption": ShieldSchema.optional(),
    sensitivity: z.number().optional(),
    piercing: z.number().optional(),
    pingCooldown: z.number().optional(),
    minAimAssistRange: z.number().optional(),
    maxAimAssistRange: z.number().optional(),
    salvageSpeedMultiplier: z.number().optional(),
    radiusMultiplier: z.number().optional(),
    extractionEfficiency: z.number().optional(),
    irSignature: z.number().optional(),
    coolingRate: z.number().optional(),
    quantumFuelRequirement: z.number().optional(),
    driveSpeed: z.number().optional(),
    cooldownTime: z.number().optional(),
    spoolUpTime: z.number().optional(),
    stageOneAccelRate: z.number().optional(),
    stageTwoAccelRate: z.number().optional(),
    quantumFuelRate: z.number().optional(),
    beams: z.array(BeamSchema).optional(),
    fuelRate: z.number().optional(),
    powerOutput: z.number().optional(),
    minForce: z.number().optional(),
    maxForce: z.number().optional(),
    minDistance: z.number().optional(),
    maxDistance: z.number().optional(),
    fullStrengthDistance: z.number().optional(),
    maxVolume: z.number().optional(),
});
export type Item = z.infer<typeof ItemSchema>;

export const CraftingItemsSchema = z.object({
    version: z.string(),
    "meta": MetaSchema,
    damageResistancePools: z.array(DamageResistancePoolSchema),
    signaturesPools: z.array(z.array(SignaturesPoolSchema)),
    fireModesPools: z.array(z.array(FireModesPoolSchema)),
    ammoPools: z.array(AmmoPoolSchema),
    magazinePools: z.array(MagazinePoolSchema),
    manufacturers: z.record(z.string(), ManufacturerSchema),
    items: z.array(ItemSchema),
});
export type CraftingItems = z.infer<typeof CraftingItemsSchema>;
