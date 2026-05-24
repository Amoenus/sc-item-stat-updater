import { z } from 'zod';

import { MinStandingNameSchema, NameKeySchema, ScopeNameSchema } from './enums.schema.js';

// ---------------------------------------------------------------------------
// Reputation, faction, and standing schemas for the merged data domain.
// ---------------------------------------------------------------------------

export const RankSchema = z.object({
  guid: z.string(),
  name: z.string(),
  nameKey: z.string(),
  minReputation: z.number(),
  rangeXP: z.union([z.number(), z.null()]),
  rankIndex: z.number(),
});
export type Rank = z.infer<typeof RankSchema>;

export const ScopeSchema = z.object({
  scopeName: ScopeNameSchema,
  ranks: z.array(RankSchema),
});
export type Scope = z.infer<typeof ScopeSchema>;

export const FactionSchema = z.object({
  name: z.string(),
  nameKey: z.union([z.null(), z.string()]),
  isNPC: z.string(),
  logo: z.union([z.null(), z.string()]),
});
export type Faction = z.infer<typeof FactionSchema>;

export const FactionRewardsSchema = z.object({
  factionGuid: z.string(),
  scopeGuid: z.string(),
  amount: z.number(),
});
export type FactionRewards = z.infer<typeof FactionRewardsSchema>;

export const ReputationMultiplierSchema = z.object({
  reputationRewardMultiplier: z.number(),
});
export type ReputationMultiplier = z.infer<typeof ReputationMultiplierSchema>;

export const StandingSchema = z.object({
  guid: z.string(),
  name: MinStandingNameSchema,
  minReputation: z.number(),
  nameKey: NameKeySchema,
  includeWhenSharing: z.boolean().optional(),
});
export type Standing = z.infer<typeof StandingSchema>;

export const MinStandingSchema = z.object({
  guid: z.string(),
  name: z.string(),
  minReputation: z.number(),
  nameKey: z.string(),
  scopeName: ScopeNameSchema.optional(),
  scopeGuid: z.string().optional(),
  includeWhenSharing: z.boolean(),
});
export type MinStanding = z.infer<typeof MinStandingSchema>;

export const TierSchema = z.object({
  minPoints: z.number(),
  badge: z.string(),
});
export type Tier = z.infer<typeof TierSchema>;

export const EventScopeSchema = z.object({
  eventName: z.string(),
  category: z.union([z.null(), z.string()]),
  tiers: z.array(TierSchema),
});
export type EventScope = z.infer<typeof EventScopeSchema>;
