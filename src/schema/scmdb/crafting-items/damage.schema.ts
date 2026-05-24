import { z } from 'zod';

// ---------------------------------------------------------------------------
// Damage-related schemas for the crafting-items data domain.
// ---------------------------------------------------------------------------

export const DamageSchema = z.object({
  physical: z.number(),
  energy: z.number(),
  distortion: z.number(),
  thermal: z.number(),
  biochemical: z.number(),
  stun: z.number(),
});
export type Damage = z.infer<typeof DamageSchema>;

export const DamageDropoffSchema = z.object({
  minDistance: DamageSchema,
  perMeter: DamageSchema,
  minDamage: DamageSchema,
});
export type DamageDropoff = z.infer<typeof DamageDropoffSchema>;

export const BiochemicalSchema = z.object({
  multiplier: z.number(),
  threshold: z.number(),
});
export type Biochemical = z.infer<typeof BiochemicalSchema>;

export const DamageResistancePoolSchema = z.object({
  physical: BiochemicalSchema,
  energy: BiochemicalSchema,
  distortion: BiochemicalSchema,
  thermal: BiochemicalSchema,
  biochemical: BiochemicalSchema,
  stun: BiochemicalSchema,
  impactForce: z.number(),
});
export type DamageResistancePool = z.infer<typeof DamageResistancePoolSchema>;
