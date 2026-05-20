// @ts-check
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Simple enum schemas for the crafting-blueprints data domain.
// ---------------------------------------------------------------------------

export const GearSchema = z.enum(['fpsgear', 'missionitems', 'vehiclegear']);
export type Gear = z.infer<typeof GearSchema>;

export const SubtypeSchema = z.enum([
  'ballistic',
  'combat',
  'cosmonaut',
  'distortion',
  'electron',
  'engineer',
  'environment',
  'explorer',
  'flightsuit',
  'hunter',
  'large',
  'laser',
  'lmg',
  'medic',
  'medium',
  'miner',
  'nozzle',
  'pistol',
  'plasma',
  'racer',
  'radiation',
  'rifle',
  'salvager',
  'shotgun',
  'size0',
  'size1',
  'size2',
  'size3',
  'size4',
  'small',
  'smg',
  'sniper',
  'stealth',
  'undersuit',
]);
export type Subtype = z.infer<typeof SubtypeSchema>;

export const PropertyKeySchema = z.enum([
  'armor_damagemitigation',
  'armor_radiationdissipation',
  'armor_temperaturemax',
  'armor_temperaturemin',
  'health_maxhealth',
  'itemresource_coolantgeneration',
  'itemresource_powergeneration',
  'quantum_fuelrequirement',
  'quantum_speed',
  'radar_maxaimassistdistance',
  'radar_minaimassistdistance',
  'shield_maxhealth',
  'weapon_damage',
  'weapon_firerate',
  'weapon_hullscraping_efficiency',
  'weapon_hullscraping_radius',
  'weapon_hullscraping_speed',
  'weapon_recoil_handling',
  'weapon_recoil_kick',
  'weapon_recoil_smoothness',
  'weapon_tractor_force',
  'weapon_tractor_fullstrengthdist',
  'weapon_tractor_maxdist',
  'weapon_tractor_maxvolume',
]);
export type PropertyKey = z.infer<typeof PropertyKeySchema>;

export const NameSchema = z.enum([
  'Beam Force',
  'Coolant Rating',
  'Craft Speed',
  'Damage Mitigation',
  'Dismantle Efficiency',
  'Efficiency',
  'Fire Rate',
  'Full Strength Dist.',
  'Impact Force',
  'Integrity',
  'Max. Assist Distance',
  'Max. Distance',
  'Max. Shield Strength',
  'Max Temp',
  'Max. Volume',
  'Min. Assist Distance',
  'Min Temp',
  'Power Pips',
  'Quantum Fuel Burn',
  'Quantum Speed',
  'Radiation Capacity',
  'Radiation Dissipation',
  'Radius',
  'Recoil Handling',
  'Recoil Kick',
  'Recoil Smoothness',
  'Reload Speed',
  'Speed',
  'Spread',
]);
export type Name = z.infer<typeof NameSchema>;

export const ItemSchema = z.enum([
  'Aphorite',
  'Beradom',
  'Carinite',
  'Dolivine',
  'Feynmaline',
  'Glacosite',
  'Hadanite',
  'Janalite',
  'Sadaryx',
  'Saldynium (Ore)',
  'Yormandi Eye',
]);
export type Item = z.infer<typeof ItemSchema>;

export const ResourceSchema = z.enum([
  'Agricium',
  'Aluminum',
  'Aslarite',
  'Beryl',
  'Bexalite',
  'Borase',
  'Copper',
  'Corundum',
  'Gold',
  'Hephaestanite',
  'Iron',
  'Laranite',
  'Lindinium',
  'Ouratite',
  'Pressurized Ice',
  'Quantainium',
  'Quartz',
  'Riccite',
  'Savrilium',
  'Silicon',
  'Stileron',
  'Taranite',
  'Tin',
  'Titanium',
  'Torite',
  'Tungsten',
]);
export type Resource = z.infer<typeof ResourceSchema>;

export const OptionTypeSchema = z.enum(['item', 'resource']);
export type OptionType = z.infer<typeof OptionTypeSchema>;

export const BlueprintTypeSchema = z.enum([
  'ammo',
  'armour',
  'cooler',
  'mininglaser',
  'powerplant',
  'quantumdrive',
  'radar',
  'refuelling',
  'salvage',
  'shield',
  'tractorbeam',
  'weapons',
]);
export type BlueprintType = z.infer<typeof BlueprintTypeSchema>;

export const CategorySchema = z.enum(['armor', 'crafter', 'other', 'weapon']);
export type Category = z.infer<typeof CategorySchema>;
