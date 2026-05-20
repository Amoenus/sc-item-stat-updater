// @ts-check
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Simple enum schemas for the crafting-items data domain.
// ---------------------------------------------------------------------------

export const NameSchema = z.enum([
  'Burst',
  'Charge',
  'Damage Beam',
  'Rapid',
  'Sequence',
  'Shotgun',
  'Single',
]);
export type Name = z.infer<typeof NameSchema>;

export const DelayUnitSchema = z.enum(['RPM', 'Seconds']);
export type DelayUnit = z.infer<typeof DelayUnitSchema>;

export const SequenceEntryTypeSchema = z.enum([
  'beam',
  'burst',
  'charged',
  'rapid',
  'sequence',
  'single',
]);
export type SequenceEntryType = z.infer<typeof SequenceEntryTypeSchema>;

export const SequenceModeSchema = z.enum(['Automatically', 'Individually', 'Looping']);
export type SequenceMode = z.infer<typeof SequenceModeSchema>;

export const AttachSubTypeSchema = z.enum([
  'Gun',
  'Heavy',
  'Helmet',
  'Light',
  'LightArmor',
  'Magazine',
  'Medium',
  'MidRangeRadar',
  'NoseMounted',
  'Personal',
  'Power',
  'Small',
  'UNDEFINED',
]);
export type AttachSubType = z.infer<typeof AttachSubTypeSchema>;

export const TypeSchema = z.enum([
  'Char_Armor_Arms',
  'Char_Armor_Backpack',
  'Char_Armor_Helmet',
  'Char_Armor_Legs',
  'Char_Armor_Torso',
  'Char_Armor_Undersuit',
  'Cooler',
  'DockingCollar',
  'Misc',
  'PowerPlant',
  'QuantumDrive',
  'Radar',
  'SalvageHead',
  'SalvageModifier',
  'Shield',
  'TractorBeam',
  'WeaponAttachment',
  'WeaponGun',
  'WeaponMining',
  'WeaponPersonal',
]);
export type Type = z.infer<typeof TypeSchema>;

export const HitTypeSchema = z.enum(['ElectricArc', 'Extraction']);
export type HitType = z.infer<typeof HitTypeSchema>;

export const CategorySchema = z.enum(['Long', 'Medium', 'Short']);
export type Category = z.infer<typeof CategorySchema>;

export const ComponentClassSchema = z.enum([
  'Ballistic',
  'Civilian',
  'Competition',
  'Electron',
  'Energy',
  'Industrial',
  'Laser',
  'Military',
  'Stealth',
]);
export type ComponentClass = z.infer<typeof ComponentClassSchema>;

export const ItemTypeSchema = z.enum(['armor', 'shipcomponent', 'unknown', 'weapon']);
export type ItemType = z.infer<typeof ItemTypeSchema>;

export const SignaturesPoolTypeSchema = z.enum(['Electromagnetic', 'Infrared']);
export type SignaturesPoolType = z.infer<typeof SignaturesPoolTypeSchema>;
