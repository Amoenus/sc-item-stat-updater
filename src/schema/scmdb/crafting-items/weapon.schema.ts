import { z } from 'zod';
import { DamageDropoffSchema, DamageSchema } from './damage.schema.js';
import {
  DelayUnitSchema,
  HitTypeSchema,
  NameSchema,
  SequenceEntryTypeSchema,
  SequenceModeSchema,
} from './enums.schema.js';

// ---------------------------------------------------------------------------
// Weapon fire-mode, ammo, and magazine schemas for the crafting-items domain.
// ---------------------------------------------------------------------------

export const RecoilSchema = z.object({
  yawMaxDeg: z.number(),
  pitchMaxDeg: z.number(),
  rollMaxDeg: z.number(),
  maxFireTime: z.number(),
  smoothTime: z.number(),
  decayStart: z.number(),
  minDecay: z.number(),
  maxDecay: z.number(),
});
export type Recoil = z.infer<typeof RecoilSchema>;

export const SpreadSchema = z.object({
  min: z.union([z.number(), z.null()]),
  max: z.union([z.number(), z.null()]),
  firstAttack: z.union([z.number(), z.null()]),
  attack: z.union([z.number(), z.null()]),
  decay: z.union([z.number(), z.null()]),
});
export type Spread = z.infer<typeof SpreadSchema>;

export const BeamSchema = z.object({
  hitType: HitTypeSchema,
  fullDamageRange: z.number(),
  zeroDamageRange: z.number(),
  dps: z.number(),
});
export type Beam = z.infer<typeof BeamSchema>;

export const AmmoPoolSchema = z.object({
  speed: z.number(),
  lifetime: z.number(),
  damage: DamageSchema,
  damageDropoff: z.union([DamageDropoffSchema, z.null()]),
});
export type AmmoPool = z.infer<typeof AmmoPoolSchema>;

export const MagazinePoolSchema = z.object({
  ammoCount: z.number(),
  initialAmmoCount: z.number(),
  maxRestockCount: z.number(),
});
export type MagazinePool = z.infer<typeof MagazinePoolSchema>;

export const SequenceEntrySchema = z.object({
  name: NameSchema,
  fireRate: z.number(),
  heatPerShot: z.number(),
  wearPerShot: z.number(),
  type: SequenceEntryTypeSchema,
  spread: SpreadSchema,
  pelletCount: z.number(),
  ammoCost: z.number(),
  damageMultiplier: z.number(),
  recoil: z.union([RecoilSchema, z.null()]),
  delay: z.number(),
  delayUnit: DelayUnitSchema,
  repetitions: z.number(),
  shotCount: z.number().optional(),
  cooldownTime: z.number().optional(),
});
export type SequenceEntry = z.infer<typeof SequenceEntrySchema>;

export const FireModesPoolSchema = z.object({
  name: z.union([NameSchema, z.null()]),
  type: SequenceEntryTypeSchema,
  sequenceMode: SequenceModeSchema.optional(),
  sequenceEntries: z.array(SequenceEntrySchema).optional(),
  fireRate: z.union([z.number(), z.null()]).optional(),
  heatPerShot: z.union([z.number(), z.null()]).optional(),
  wearPerShot: z.union([z.number(), z.null()]).optional(),
  spread: SpreadSchema.optional(),
  pelletCount: z.number().optional(),
  ammoCost: z.number().optional(),
  damageMultiplier: z.number().optional(),
  recoil: z.union([RecoilSchema, z.null()]).optional(),
  shotCount: z.number().optional(),
  cooldownTime: z.number().optional(),
  chargeTime: z.number().optional(),
  overchargeTime: z.number().optional(),
});
export type FireModesPool = z.infer<typeof FireModesPoolSchema>;
