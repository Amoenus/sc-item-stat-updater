import { fmtNum } from '../lib/formatter.js';

export default {
  csvFile: 'weapons.csv',
  label: 'Weapons',
  descKeyMatch(kl) {
    const prefixes = [
      'desckbar_', 'descbehr_', 'deschrst_', 'descklwe_', 'descespr_', 'descprar_',
      'descasad_', 'descvncl_', 'descglsn_', 'desckrig_', 'desc_kbar', 'desc_behr',
      'desc_hrst', 'desc_klwe', 'desc_espr', 'desc_grin',
    ];
    const types = ['cannon', 'repeater', 'gatling', 'scattergun', 'massdriver', 'laser', 'distortion'];
    return prefixes.some(p => kl.includes(p)) && types.some(t => kl.includes(t));
  },
  buildValue(r, flavorText) {
    const hasAmmo = r['Ammo Count'] && r['Ammo Count'] !== '0' && r['Ammo Count'] !== '' && r['Max Ammo'] !== '∞';

    let val = `Item Type: ${r['Type']}` +
      `\\nManufacturer: ${r['Manufacturer']}` +
      `\\nSize: ${r['Size']}` +
      `\\n\\n-- Combat Stats --` +
      `\\nAlpha Damage: ${fmtNum(r['Alpha Damage'])}` +
      `\\nDPS (Single): ${fmtNum(r['DPS Single'])}` +
      `\\nDPS (Burst): ${fmtNum(r['DPS Burst'])}` +
      `\\nRate of Fire: ${fmtNum(r['RPM'])} RPM` +
      `\\nProjectile Speed: ${fmtNum(r['Speed'])} m/s` +
      `\\nRange: ${fmtNum(r['Range'])}m`;

    if (hasAmmo) {
      val += `\\n\\n-- Ammo --` +
        `\\nAmmo Count: ${fmtNum(r['Ammo Count'])}` +
        `\\nMax Ammo: ${fmtNum(r['Max Ammo'])}`;
      if (r['Ammo Per Shot'] && r['Ammo Per Shot'] !== '∞') {
        val += `\\nAmmo Per Shot: ${fmtNum(r['Ammo Per Shot'])}`;
      }
    }

    val += `\\n\\n-- Power & Emission --` +
      `\\nPower Base: ${r['Power Base']}` +
      `\\nEM: ${fmtNum(r['EM'])}` +
      `\\n\\n-- Durability --` +
      `\\nHealth: ${fmtNum(r['Health'])}` +
      `\\nDistortion Shutdown Dmg: ${fmtNum(r['Distortion Shutdown Dmg'])}` +
      `\\nDistortion Warning Ratio: ${r['Distortion Warning Ratio']}`;

    if (flavorText) val += `\\n\\n${flavorText}`;
    return val;
  },
};
