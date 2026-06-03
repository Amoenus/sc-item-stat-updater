import { z } from 'zod';

import {
  BlueprintTypeSchema,
  CategorySchema,
  GearSchema,
  ItemSchema,
  NameSchema,
  OptionTypeSchema,
  PropertyKeySchema,
  ResourceSchema,
  SubtypeSchema,
} from './enums.schema.js';

// ---------------------------------------------------------------------------
// Object schemas and top-level schema for crafting-blueprints-*.json.
// ---------------------------------------------------------------------------

const ModifierSchema = z.object({
  startQuality: z.number(),
  endQuality: z.number(),
  modifierAtStart: z.number(),
  modifierAtEnd: z.number(),
  propertyName: NameSchema,
  propertyKey: PropertyKeySchema,
  additive: z.boolean().optional(),
});
export type Modifier = z.infer<typeof ModifierSchema>;

const OptionSchema = z.object({
  type: OptionTypeSchema,
  quantity: z.number(),
  minQuality: z.number(),
  resourceName: ResourceSchema.optional(),
  modifiers: z.null().optional(),
  itemName: ItemSchema.optional(),
});
export type Option = z.infer<typeof OptionSchema>;

const DismantleSchema = z.object({
  efficiency: z.number(),
  dismantleTimeSeconds: z.number(),
});
export type Dismantle = z.infer<typeof DismantleSchema>;

const MetaSchema = z.object({
  totalBlueprints: z.number(),
  totalProducts: z.number(),
  totalResources: z.number(),
  totalItems: z.number(),
});
export type Meta = z.infer<typeof MetaSchema>;

const NameOverridesSchema = z.object({
  WeaponMining: z.string(),
});
export type NameOverrides = z.infer<typeof NameOverridesSchema>;

const SlotSchema = z.object({
  name: z.string(),
  options: z.array(OptionSchema),
  modifiers: z.union([z.array(ModifierSchema), z.null()]),
});
export type Slot = z.infer<typeof SlotSchema>;

const PropertySchema = z.object({
  name: NameSchema,
  unit: z.union([z.null(), z.string()]),
  category: CategorySchema,
  nameOverrides: NameOverridesSchema.optional(),
});
export type Property = z.infer<typeof PropertySchema>;

const TierSchema = z.object({
  craftTimeSeconds: z.number(),
  slots: z.array(SlotSchema),
});
export type Tier = z.infer<typeof TierSchema>;

const BlueprintSchema = z.object({
  guid: z.string(),
  tag: z.string(),
  productEntityClass: z.string(),
  gear: GearSchema,
  type: z.union([BlueprintTypeSchema, z.null()]),
  subtype: z.union([SubtypeSchema, z.null()]),
  tiers: z.array(TierSchema),
  productName: z.union([z.null(), z.string()]),
  manufacturer: z.union([z.null(), z.string()]),
  isDefault: z.boolean().optional(),
  suggestedName: z.string().optional(),
  suggestedProductEntityClass: z.string().optional(),
  cigDataError: z.boolean().optional(),
});
export type Blueprint = z.infer<typeof BlueprintSchema>;

export const CraftingBlueprintsSchema = z.object({
  version: z.string(),
  meta: MetaSchema,
  dismantle: DismantleSchema,
  properties: z.record(z.string(), PropertySchema),
  resources: z.array(ResourceSchema),
  items: z.array(ItemSchema),
  blueprints: z.array(BlueprintSchema),
});
export type CraftingBlueprints = z.infer<typeof CraftingBlueprintsSchema>;

// Re-export all domain schemas so consumers can import from this single entry point.
export * from './enums.schema.js';
