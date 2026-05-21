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
