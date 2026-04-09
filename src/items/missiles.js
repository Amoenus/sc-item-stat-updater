import { fmtNum } from '../lib/formatter.js';

export default {
  csvFile: 'missiles.csv',
  label: 'Missiles',
  descKeyMatch: (kl) => kl.includes('descmisl_') || kl.includes('descgmisl_'),
  buildValue(r, flavorText) {
    const isTorpedo = parseInt(r['Size']) >= 7;
    const itemType = isTorpedo ? 'Torpedo' : 'Missile';

    let val = `Item Type: ${itemType}` +
      `\\nManufacturer: ${r['Manufacturer']}` +
      `\\nTracking Signal: ${r['Tracking Signal Type']}` +
      `\\nSize: ${r['Size']}` +
      `\\n\\n-- Damage --` +
      `\\nTotal Damage: ${fmtNum(r['Dmg Total'])}`;

    if (r['Dmg Physical'] && r['Dmg Physical'] !== '0') val += `\\nPhysical: ${fmtNum(r['Dmg Physical'])}`;
    if (r['Dmg Energy'] && r['Dmg Energy'] !== '0') val += `\\nEnergy: ${fmtNum(r['Dmg Energy'])}`;
    if (r['Dmg Distortion'] && r['Dmg Distortion'] !== '0') val += `\\nDistortion: ${fmtNum(r['Dmg Distortion'])}`;

    if (r['Cluster Count'] && r['Cluster Count'] !== '0') {
      val += `\\nCluster Count: ${r['Cluster Count']}`;
    }

    val += `\\n\\n-- Flight Stats --` +
      `\\nSpeed: ${fmtNum(r['Speed'])} m/s` +
      `\\nArm Time: ${r['Arm Time']}s` +
      `\\nLock Time: ${r['Lock Time']}s` +
      `\\nLocking Angle: ${r['Locking Angle']}°` +
      `\\nLock Range: ${fmtNum(r['Lock Range Min'])} - ${fmtNum(r['Lock Range Max'])}m` +
      `\\nIgnite Time: ${r['Ignite Time']}s` +
      `\\n\\n-- Explosion --` +
      `\\nRadius: ${r['Explosion Radius Min']} - ${r['Explosion Radius Max']}m` +
      `\\nHealth: ${fmtNum(r['Health'])}`;

    if (flavorText) val += `\\n\\n${flavorText}`;
    return val;
  },
};
