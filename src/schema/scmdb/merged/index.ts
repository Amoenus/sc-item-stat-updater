// @ts-check
import { z } from 'zod';

import { ScopeSchema, EventScopeSchema, FactionSchema, FactionRewardsSchema } from './reputation.schema.js';
import { LocationPoolSchema, PyroRegionsSchema } from './location.schema.js';
import {
  ResourcePoolsSchema,
  BlueprintPoolsSchema,
  CargoManifestPoolSchema,
  PartialRewardPayoutPoolSchema,
  AvailabilityPoolSchema,
} from './pools.schema.js';
import { ShipSchema } from './encounter.schema.js';
import { ContractSchema, LegacyContractSchema } from './contract.schema.js';

// ---------------------------------------------------------------------------
// Top-level schema for merged-*.json. Composes all domain schemas.
// ---------------------------------------------------------------------------

export const MergedSchema = z.object({
  version: z.string(),
  scopes: z.record(z.string(), ScopeSchema),
  eventScopes: z.record(z.string(), EventScopeSchema),
  locationPools: z.record(z.string(), LocationPoolSchema),
  resourcePools: ResourcePoolsSchema,
  blueprintPools: BlueprintPoolsSchema,
  shipPools: z.record(z.string(), z.array(z.string())),
  cargoManifestPools: z.record(z.string(), CargoManifestPoolSchema),
  partialRewardPayoutPools: z.array(z.array(PartialRewardPayoutPoolSchema)),
  availabilityPools: z.array(AvailabilityPoolSchema),
  factionRewardsPools: z.array(z.array(FactionRewardsSchema)),
  pyroRegions: PyroRegionsSchema,
  factions: z.record(z.string(), FactionSchema),
  ships: z.record(z.string(), z.array(ShipSchema)),
  contracts: z.array(ContractSchema),
  legacyContracts: z.array(LegacyContractSchema),
});
export type Merged = z.infer<typeof MergedSchema>;

// Re-export all domain schemas so consumers can import from this single entry point.
export * from './enums.schema.js';
export * from './location.schema.js';
export * from './reputation.schema.js';
export * from './pools.schema.js';
export * from './encounter.schema.js';
export * from './contract.schema.js';
