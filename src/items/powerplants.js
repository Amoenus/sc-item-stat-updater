// @ts-check
import { stat } from '../lib/stat-builder.js';

/** @param {string} descKey */
function getAlternateDescKeys(descKey) {
  const alts = new Set();
  if (descKey.endsWith('_SCItem')) {
    alts.add(descKey.slice(0, -7));
  }
  const toggled = descKey.replace(/(item_(?:Desc|desc|DESC))(_?)(POWR)/i, (_m, prefix, sep, cat) => {
    return prefix + (sep ? '' : '_') + cat;
  });
  if (toggled !== descKey) alts.add(toggled);
  if (descKey.endsWith('_SCItem')) {
    const stripped = descKey.slice(0, -7);
    const toggledStripped = stripped.replace(/(item_(?:Desc|desc|DESC))(_?)(POWR)/i, (_m, prefix, sep, cat) => {
      return prefix + (sep ? '' : '_') + cat;
    });
    if (toggledStripped !== stripped) alts.add(toggledStripped);
  }
  alts.delete(descKey);
  return [...alts];
}

/** @type {import('../lib/types.js').ItemConfig} */
export default {
  csvFile: 'powerplants.csv',
  label: 'Power Plants',
  requiredColumns: [
    'Localization Key',
    'Manufacturer',
    'Size',
    'Grade',
    'Class',
    'Power Generation',
    'EM Max',
    'Health',
    'Distortion Shutdown Dmg',
    'Distortion Decay Delay',
    'Distortion Decay Rate',
    'Distortion Warning Ratio',
  ],
  descKeyMatch: (kl) => kl.includes('descpowr_') || kl.includes('desc_powr_'),
  getAlternateDescKeys,
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Power Plant')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Grade', 'Grade')
      .lineIf('Class', r['Class'])
      .section('-- Power Stats --')
      .num('Power Generation', 'Power Generation')
      .section('-- Emission --')
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
