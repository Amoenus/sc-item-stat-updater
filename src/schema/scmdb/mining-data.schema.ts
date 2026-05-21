// @ts-check
import { z } from 'zod';

// ---------------------------------------------------------------------------
// mining_data-*.json (pipeline schema)
// ---------------------------------------------------------------------------

export const MineableElementSchema = z.object({
  name: z.string(),
  rarity: z.string().optional(),
  groundScanSignature: z.number().optional(),
  scanSignature: z.number().optional(),
  resistance: z.number().optional(),
  instability: z.number().optional(),
});
export type MineableElement = z.infer<typeof MineableElementSchema>;

export const CompositionPartSchema = z.object({
  elementName: z.string().optional(),
});
export type CompositionPart = z.infer<typeof CompositionPartSchema>;

export const CompositionSchema = z.object({
  name: z.string().optional(),
  parts: z.array(CompositionPartSchema).optional(),
});
export type Composition = z.infer<typeof CompositionSchema>;

export const DepositSchema = z.object({
  compositionGuid: z.string().optional(),
  relativeProbability: z.number().optional(),
});
export type Deposit = z.infer<typeof DepositSchema>;

export const MiningGroupSchema = z.object({
  groupName: z.string(),
  groupProbability: z.number().optional(),
  deposits: z.array(DepositSchema).optional(),
});
export type MiningGroup = z.infer<typeof MiningGroupSchema>;

export const MiningLocationSchema = z.object({
  locationName: z.string(),
  groups: z.array(MiningGroupSchema).optional(),
});
export type MiningLocation = z.infer<typeof MiningLocationSchema>;

export const QualityDistributionEntrySchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
});
export type QualityDistributionEntry = z.infer<typeof QualityDistributionEntrySchema>;

export const LocationOverrideEntrySchema = z.object({
  distribution: QualityDistributionEntrySchema.optional(),
  locations: z.array(z.string()).optional(),
});
export type LocationOverrideEntry = z.infer<typeof LocationOverrideEntrySchema>;

export const RarityDataSchema = z.object({
  default: QualityDistributionEntrySchema.optional(),
  locationOverrides: z.record(z.string(), z.array(LocationOverrideEntrySchema)).optional(),
});
export type RarityData = z.infer<typeof RarityDataSchema>;

export const QualityDistributionSchema = z.object({
  shipmineables: z.record(z.string(), RarityDataSchema).optional(),
});
export type QualityDistribution = z.infer<typeof QualityDistributionSchema>;

export const MiningDataSchema = z.object({
  mineableElements: z.record(z.string(), MineableElementSchema).optional(),
  compositions: z.record(z.string(), CompositionSchema).optional(),
  locations: z.array(MiningLocationSchema).optional(),
  qualityDistribution: QualityDistributionSchema.optional(),
});
export type MiningData = z.infer<typeof MiningDataSchema>;

// ---------------------------------------------------------------------------
// CSV Row Output Schemas
// ---------------------------------------------------------------------------

export const MiningElementRowSchema = z.object({
  'Element Name': z.string(),
  Rarity: z.string().optional(),
  'Ground Scan Signature': z.number().optional(),
  'Scan Signature': z.number().optional(),
  Resistance: z.number().optional(),
  Instability: z.number().optional(),
});
export type MiningElementRowDTO = z.infer<typeof MiningElementRowSchema>;

export const MiningJournalRowSchema = z.object({
  'Rarity Category': z.string(),
  'Element List': z.string(),
});
export type MiningJournalRowDTO = z.infer<typeof MiningJournalRowSchema>;

export const MiningLocationRowSchema = z.object({
  'Location Name': z.string(),
  'Ship Mineables': z.string(),
  'Hand Mineables': z.string(),
  'Ground Vehicle Mineables': z.string(),
  'Quality Note': z.string(),
});
export type MiningLocationRowDTO = z.infer<typeof MiningLocationRowSchema>;
