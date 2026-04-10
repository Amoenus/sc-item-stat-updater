// @ts-check
import { stat } from '../lib/stat-builder.js';

/** @type {import('../lib/types.js').ItemConfig} */
export default {
  csvFile: 'shields.csv',
  label: 'Shields',
  requiredColumns: [
    'Localization Key',
    'Manufacturer',
    'Size',
    'Grade',
    'Class',
    'Pool HP',
    'Max Shield Generation',
    'Min Regen Time (0 to full)',
    'Damaged Regen Delay',
    'Downed Regen Delay',
    'Physical Resistance Min / Max',
    'Energy Resistance Min / Max',
    'Distortion Resistance Min / Max',
    'Physical Absorption Min / Max',
    'Energy Absorption Min / Max',
    'Distortion Absorption Min / Max',
    'Power Consumption',
    'EM Max',
    'Health',
    'Distortion Shutdown Dmg',
    'Distortion Decay Delay',
    'Distortion Decay Rate',
    'Distortion Warning Ratio',
  ],
  descKeyMatch: (kl) => kl.includes('descshld_') || kl.includes('desc_shld_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Shield Generator')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Grade', 'Grade')
      .lineIf('Class', r['Class'])
      .section('-- Shield Stats --')
      .num('Pool HP', 'Pool HP')
      .num('Max Shield Generation', 'Max Shield Generation')
      .raw('Min Regen Time', 'Min Regen Time (0 to full)')
      .raw('Damaged Regen Delay', 'Damaged Regen Delay')
      .raw('Downed Regen Delay', 'Downed Regen Delay')
      .section('-- Resistances (Min/Max) --')
      .raw('Physical', 'Physical Resistance Min / Max')
      .raw('Energy', 'Energy Resistance Min / Max')
      .raw('Distortion', 'Distortion Resistance Min / Max')
      .section('-- Absorption (Min/Max) --')
      .raw('Physical', 'Physical Absorption Min / Max')
      .raw('Energy', 'Energy Absorption Min / Max')
      .raw('Distortion', 'Distortion Absorption Min / Max')
      .section('-- Power & Emission --')
      .raw('Power Consumption', 'Power Consumption')
      .num('EM Max', 'EM Max')
      .section('-- Durability & Distortion --')
      .num('Health', 'Health')
      .num('Distortion Shutdown Dmg', 'Distortion Shutdown Dmg')
      .raw('Distortion Decay Delay', 'Distortion Decay Delay', 's')
      .raw('Distortion Decay Rate', 'Distortion Decay Rate')
      .raw('Distortion Warning Ratio', 'Distortion Warning Ratio')
      .build(flavorText);
  },
};
