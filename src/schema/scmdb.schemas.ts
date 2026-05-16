// @ts-check
import { z } from 'zod';

// ---------------------------------------------------------------------------
// versions.json
// ---------------------------------------------------------------------------

export const ScmdbVersionEntrySchema = z.object({
  version: z.string(),
  file: z.string(),
});

export const ScmdbVersionsSchema = z.array(ScmdbVersionEntrySchema).min(1);

// ---------------------------------------------------------------------------
// Merged data (contracts, legacyContracts, blueprintPools)
// ---------------------------------------------------------------------------

const ScmdbStandingSchema = z.object({
  guid: z.string(),
  name: z.string(),
  minReputation: z.number(),
  nameKey: z.string(),
  scopeName: z.string().optional(),
  scopeGuid: z.string().optional(),
});

/**
 * prerequisites is intentionally loose: its shape varies across contract types
 * (location prerequisites, faction prerequisites, completedContractTags, etc.).
 * Only the one field accessed structurally by the transformation pipeline is
 * typed concretely; everything else passes through for serialisation.
 */
const ScmdbPrerequisitesSchema = z.looseObject({
  completedContractTags: z
    .object({ tags: z.array(z.string()).optional() })
    .nullish(),
});

const ScmdbBlueprintRewardEntrySchema = z.object({
  blueprintPool: z.string().optional(),
  poolName: z.string().nullish(),
  chance: z.number().nullish(),
  trigger: z.string().nullish(),
});

const ScmdbCompletionTagSchema = z.object({
  tag: z.string().optional(),
});

const ScmdbContractSchema = z.object({
  id: z.string(),
  debugName: z.string().nullish(),
  category: z.string().nullish(),
  missionType: z.string().nullish(),
  missionTypeKey: z.string().nullish(),
  title: z.string().nullish(),
  titleKey: z.string().nullish(),
  description: z.string().nullish(),
  descriptionKey: z.string().nullish(),
  descriptionLocKey: z.string().nullish(),
  rewardUEC: z.number().nullish(),
  timeToComplete: z.number().nullish(),
  canBeShared: z.boolean().nullish(),
  illegal: z.boolean().nullish(),
  factionGuid: z.string().nullish(),
  locations: z.array(z.string()).nullish(),
  destinations: z.array(z.string()).nullish(),
  prerequisites: ScmdbPrerequisitesSchema.nullish(),
  tokenSubstitutions: z.record(z.string(), z.string()).nullish(),
  minStanding: ScmdbStandingSchema.nullish(),
  maxStanding: ScmdbStandingSchema.nullish(),
  blueprintRewards: z.array(ScmdbBlueprintRewardEntrySchema).nullish(),
  completionTags: z.array(ScmdbCompletionTagSchema).nullish(),
});

const ScmdbBlueprintPoolSchema = z.object({
  name: z.string().nullish(),
  source: z.string().nullish(),
  blueprints: z.array(z.object({ name: z.string().nullish() })).nullish(),
});

export const ScmdbMergedDataSchema = z.object({
  contracts: z.array(ScmdbContractSchema).optional().default([]),
  legacyContracts: z.array(ScmdbContractSchema).optional().default([]),
  blueprintPools: z.record(z.string(), ScmdbBlueprintPoolSchema).nullish(),
});

// ---------------------------------------------------------------------------
// Mining data
// ---------------------------------------------------------------------------

const ScmdbMineableElementSchema = z.object({
  name: z.string(),
  rarity: z.string().optional(),
  groundScanSignature: z.number().optional(),
  scanSignature: z.number().optional(),
  resistance: z.number().optional(),
  instability: z.number().optional(),
});

const ScmdbCompositionPartSchema = z.object({
  elementName: z.string().optional(),
});

const ScmdbCompositionSchema = z.object({
  name: z.string().optional(),
  parts: z.array(ScmdbCompositionPartSchema).optional(),
});

const ScmdbDepositSchema = z.object({
  compositionGuid: z.string().optional(),
  relativeProbability: z.number().optional(),
});

const ScmdbMiningGroupSchema = z.object({
  groupName: z.string(),
  groupProbability: z.number().optional(),
  deposits: z.array(ScmdbDepositSchema).optional(),
});

const ScmdbMiningLocationSchema = z.object({
  locationName: z.string(),
  groups: z.array(ScmdbMiningGroupSchema).optional(),
});

const ScmdbQualityDistributionEntrySchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
});

const ScmdbLocationOverrideEntrySchema = z.object({
  distribution: ScmdbQualityDistributionEntrySchema.optional(),
  locations: z.array(z.string()).optional(),
});

const ScmdbRarityDataSchema = z.object({
  default: ScmdbQualityDistributionEntrySchema.optional(),
  locationOverrides: z.record(z.string(), z.array(ScmdbLocationOverrideEntrySchema)).optional(),
});

const ScmdbQualityDistributionSchema = z.object({
  shipmineables: z.record(z.string(), ScmdbRarityDataSchema).optional(),
});

export const ScmdbMiningDataSchema = z.object({
  mineableElements: z.record(z.string(), ScmdbMineableElementSchema).optional(),
  compositions: z.record(z.string(), ScmdbCompositionSchema).optional(),
  locations: z.array(ScmdbMiningLocationSchema).optional(),
  qualityDistribution: ScmdbQualityDistributionSchema.optional(),
});

// ---------------------------------------------------------------------------
// Crafting data (stored raw; top-level structure validated)
// ---------------------------------------------------------------------------

export const ScmdbCraftingItemsSchema = z.object({
  version: z.string(),
});

export const ScmdbCraftingBlueprintsSchema = z.object({
  version: z.string(),
});
