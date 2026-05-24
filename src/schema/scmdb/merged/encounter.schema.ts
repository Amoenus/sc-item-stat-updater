import { z } from 'zod';

import { CareerSchema, CargoManifestElementSchema, ClassificationSchema } from './enums.schema.js';

// ---------------------------------------------------------------------------
// Ship encounter, spawn config, and wave schemas for the merged data domain.
// ---------------------------------------------------------------------------

export const SlotSchema = z.object({
  poolId: z.string(),
  minCount: z.number(),
  maxCount: z.number(),
});
export type Slot = z.infer<typeof SlotSchema>;

export const WaveSchema = z.object({
  name: z.union([z.null(), z.string()]),
  minShips: z.number(),
  maxShips: z.number(),
  slots: z.array(SlotSchema).optional(),
});
export type Wave = z.infer<typeof WaveSchema>;

export const ShipSchema = z.object({
  name: z.string(),
  career: CareerSchema,
  role: z.string(),
});
export type Ship = z.infer<typeof ShipSchema>;

export const SpawnConfigGroupSchema = z.object({
  role: z.string(),
  poolId: z.string(),
  waves: z.array(WaveSchema),
  classification: ClassificationSchema,
  cargoManifest: z.union([z.array(CargoManifestElementSchema), CargoManifestElementSchema]).optional(),
  spawnChance: z.number().optional(),
});
export type SpawnConfigGroup = z.infer<typeof SpawnConfigGroupSchema>;

export const SpawnConfigSchema = z.object({
  groups: z.array(SpawnConfigGroupSchema),
  waveDelay: z.union([z.number(), z.null()]),
  numberOfWaves: z.union([z.number(), z.null()]),
  totalMinShips: z.number(),
  totalMaxShips: z.number(),
});
export type SpawnConfig = z.infer<typeof SpawnConfigSchema>;

export const ShipEncountersSchema = z.object({
  spawnConfig: SpawnConfigSchema,
});
export type ShipEncounters = z.infer<typeof ShipEncountersSchema>;
