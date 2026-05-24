// @ts-check
import { z } from 'zod';

import { FillTypeSchema, SourceSchema } from './enums.schema.js';
import { ReputationMultiplierSchema } from './reputation.schema.js';

// ---------------------------------------------------------------------------
// Resource, blueprint, cargo, and payout pool schemas for the merged domain.
// ---------------------------------------------------------------------------

export const AvailabilityPoolSchema = z.object({});
export type AvailabilityPool = z.infer<typeof AvailabilityPoolSchema>;

export const ResourceElementSchema = z.object({
  name: z.string(),
  prob: z.number(),
});
export type ResourceElement = z.infer<typeof ResourceElementSchema>;

export const ResourcePoolEntrySchema = z.object({
  name: z.string(),
  nameKey: z.string().optional(),
});
export type ResourcePoolEntry = z.infer<typeof ResourcePoolEntrySchema>;

export const ResourcePoolsSchema = z.record(z.string(), ResourcePoolEntrySchema);
export type ResourcePools = z.infer<typeof ResourcePoolsSchema>;

/**
 * Stricter resource pool entry shape used by the commodity parser.
 * Requires `nameKey` to be present and match the localization key format
 * (`word characters`, hyphens, and dots — no spaces or special chars).
 */
export const CommodityResourcePoolEntrySchema = z.object({
  name: z.string(),
  nameKey: z.string().min(1).regex(/^[\w\-.]+$/, 'nameKey must be a valid localization key'),
});
export type CommodityResourcePoolEntry = z.infer<typeof CommodityResourcePoolEntrySchema>;

/**
 * Validates the top-level structure of a merged-*.json file for commodity
 * parsing. Entries in `resourcePools` are left as `unknown` so the parser can
 * validate each one individually with {@link CommodityResourcePoolEntrySchema}
 * and discard invalid entries rather than failing the entire parse.
 */
export const CommodityInputSchema = z.object({
  resourcePools: z.record(z.string(), z.unknown()),
});
export type CommodityInput = z.infer<typeof CommodityInputSchema>;

export const BlueprintItemSchema = z.object({
  weight: z.number(),
  name: z.union([z.null(), z.string()]).optional(),
});
export type BlueprintItem = z.infer<typeof BlueprintItemSchema>;

export const BlueprintPoolEntrySchema = z.object({
  name: z.string(),
  blueprints: z.array(BlueprintItemSchema),
  source: SourceSchema,
});
export type BlueprintPoolEntry = z.infer<typeof BlueprintPoolEntrySchema>;

export const BlueprintPoolsSchema = z.record(z.string(), BlueprintPoolEntrySchema);
export type BlueprintPools = z.infer<typeof BlueprintPoolsSchema>;

export const CargoManifestPoolSchema = z.object({
  fillType: FillTypeSchema,
  fillMin: z.number(),
  fillMax: z.number(),
  resources: z.array(ResourceElementSchema),
});
export type CargoManifestPool = z.infer<typeof CargoManifestPoolSchema>;

export const PartialRewardPayoutPoolSchema = z.object({
  minPercentage: z.number(),
  maxPercentage: z.number(),
  currencyRewardMultiplier: z.number(),
  reputationMultipliers: z.union([z.array(ReputationMultiplierSchema), z.null()]),
});
export type PartialRewardPayoutPool = z.infer<typeof PartialRewardPayoutPoolSchema>;
