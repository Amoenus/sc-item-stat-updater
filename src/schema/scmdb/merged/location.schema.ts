// @ts-check
import { z } from 'zod';

import { NavIconEnumSchema, PlanetEnumSchema, PlanetSchema, SystemSchema } from './enums.schema.js';

// ---------------------------------------------------------------------------
// Location and navigation schemas for the merged data domain.
// ---------------------------------------------------------------------------

export const ResolvedLocationElementSchema = z.object({
  name: z.string(),
  navIcon: NavIconEnumSchema,
});
export type ResolvedLocationElement = z.infer<typeof ResolvedLocationElementSchema>;

export const StarElementSchema = z.object({
  guid: z.string(),
  name: z.string(),
  navIcon: NavIconEnumSchema,
});
export type StarElement = z.infer<typeof StarElementSchema>;

export const SubLocationVariantSchema = z.object({
  guid: z.string(),
  name: PlanetEnumSchema,
  navIcon: NavIconEnumSchema,
  star: StarElementSchema.optional(),
  planet: StarElementSchema.optional(),
});
export type SubLocationVariant = z.infer<typeof SubLocationVariantSchema>;

export const TagSearchLocationSchema = z.object({
  system: z.union([PlanetEnumSchema, z.null()]),
  planet: z.union([PlanetEnumSchema, z.null()]),
});
export type TagSearchLocation = z.infer<typeof TagSearchLocationSchema>;

export const LocationPropertySchema = z.object({
  resolvedLocations: z.union([z.array(ResolvedLocationElementSchema), z.null()]),
});
export type LocationProperty = z.infer<typeof LocationPropertySchema>;

export const LocationSetSchema = z.object({
  locations: z.union([z.array(z.string()), z.null()]),
  destinations: z.union([z.array(z.string()), z.null()]).optional(),
});
export type LocationSet = z.infer<typeof LocationSetSchema>;

export const LocationPoolSchema = z.object({
  name: z.string(),
  type: NavIconEnumSchema,
  system: z.union([SystemSchema, z.null()]),
  planet: z.union([PlanetSchema, z.null()]),
  moon: z.union([z.null(), z.string()]),
});
export type LocationPool = z.infer<typeof LocationPoolSchema>;

export const PyroRegionAreaSchema = z.object({
  guid: z.string(),
  locations: z.array(StarElementSchema),
});
export type PyroRegionArea = z.infer<typeof PyroRegionAreaSchema>;

export const PyroRegionsSchema = z.object({
  A: PyroRegionAreaSchema,
  B: PyroRegionAreaSchema,
  C: PyroRegionAreaSchema,
  D: PyroRegionAreaSchema,
});
export type PyroRegions = z.infer<typeof PyroRegionsSchema>;
