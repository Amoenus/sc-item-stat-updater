import { fmtNum } from '../lib/formatter.js';

export default {
  csvFile: 'bombs.csv',
  label: 'Bombs',
  descKeyMatch: (kl) => kl.includes('descbomb_'),
  buildValue(r, flavorText) {
    let val =
      `Item Type: Bomb` +
      `\\nManufacturer: ${r['Manufacturer']}` +
      `\\nSize: ${r['Size']}` +
      `\\n\\n-- Damage --` +
      `\\nTotal Damage: ${fmtNum(r['Dmg Total'])}`;

    if (r['Dmg Energy'] && r['Dmg Energy'] !== '0') val += `\\nEnergy Damage: ${fmtNum(r['Dmg Energy'])}`;
    if (r['Dmg Physical'] && r['Dmg Physical'] !== '0') val += `\\nPhysical Damage: ${fmtNum(r['Dmg Physical'])}`;
    if (r['Dmg Distortion'] && r['Dmg Distortion'] !== '0')
      val += `\\nDistortion Damage: ${fmtNum(r['Dmg Distortion'])}`;
    if (r['Dmg Biochemical'] && r['Dmg Biochemical'] !== '0')
      val += `\\nBiochemical Damage: ${fmtNum(r['Dmg Biochemical'])}`;
    if (r['Dmg Stun'] && r['Dmg Stun'] !== '0') val += `\\nStun Damage: ${fmtNum(r['Dmg Stun'])}`;
    if (r['Dmg Thermal'] && r['Dmg Thermal'] !== '0') val += `\\nThermal Damage: ${fmtNum(r['Dmg Thermal'])}`;

    val +=
      `\\n\\n-- Stats --` +
      `\\nArm Time: ${r['Arm Time']}s` +
      `\\nIgnite Time: ${r['Ignite Time']}s` +
      `\\nExplosion Radius: ${r['Explosion Radius Min']} - ${r['Explosion Radius Max']}m` +
      `\\nHealth: ${fmtNum(r['Health'])}`;

    if (flavorText) val += `\\n\\n${flavorText}`;
    return val;
  },
};
