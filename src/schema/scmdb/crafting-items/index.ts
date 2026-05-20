// @ts-check
import { z } from 'zod';

import {
  TypeSchema,
  CategorySchema,
  ComponentClassSchema,
  ItemTypeSchema,
  AttachSubTypeSchema,
  SignaturesPoolTypeSchema,
} from './enums.schema.js';
import { DamageResistancePoolSchema } from './damage.schema.js';
import { BeamSchema, FireModesPoolSchema, AmmoPoolSchema, MagazinePoolSchema } from './weapon.schema.js';

// ---------------------------------------------------------------------------
// Item, physical-property, and top-level schemas for the crafting-items domain.
// ---------------------------------------------------------------------------

export const CombatRangeSchema = z.object({
  ideal: z.number(),
  max: z.number(),
  category: CategorySchema,
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

export const ShieldSchema = z.object({
  physical: TemperatureResistanceSchema,
  energy: TemperatureResistanceSchema,
  distortion: TemperatureResistanceSchema,
  thermal: TemperatureResistanceSchema,
  biochemical: TemperatureResistanceSchema,
  stun: TemperatureResistanceSchema,
});
export type Shield = z.infer<typeof ShieldSchema>;

export const SignaturesPoolSchema = z.object({
  type: SignaturesPoolTypeSchema,
  emission: z.number(),
  reductionWeighted: z.number(),
  reductionAbsolute: z.number(),
});
export type SignaturesPool = z.infer<typeof SignaturesPoolSchema>;

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

export const ItemSchema = z.object({
  entityClass: z.string(),
  itemType: ItemTypeSchema,
  attachType: TypeSchema,
  attachSubType: AttachSubTypeSchema,
  size: z.number(),
  grade: z.number(),
  tags: z.string(),
  manufacturer: z.union([z.null(), z.string()]),
  manufacturerCode: z.union([z.null(), z.string()]),
  mass: z.number(),
  combatRange: CombatRangeSchema.optional(),
  name: z.union([z.null(), z.string()]),
  cgItemType: TypeSchema,
  fireModesIndex: z.number().optional(),
  ammoIndex: z.number().optional(),
  magazineIndex: z.number().optional(),
  componentClass: ComponentClassSchema.optional(),
  temperatureResistance: TemperatureResistanceSchema.optional(),
  radiationResistance: RadiationResistanceSchema.optional(),
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
  shieldResistance: ShieldSchema.optional(),
  shieldAbsorption: ShieldSchema.optional(),
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
  meta: MetaSchema,
  damageResistancePools: z.array(DamageResistancePoolSchema),
  signaturesPools: z.array(z.array(SignaturesPoolSchema)),
  fireModesPools: z.array(z.array(FireModesPoolSchema)),
  ammoPools: z.array(AmmoPoolSchema),
  magazinePools: z.array(MagazinePoolSchema),
  manufacturers: z.record(z.string(), ManufacturerSchema),
  items: z.array(ItemSchema),
});
export type CraftingItems = z.infer<typeof CraftingItemsSchema>;

// Re-export all domain schemas so consumers can import from this single entry point.
export * from './enums.schema.js';
export * from './damage.schema.js';
export * from './weapon.schema.js';
