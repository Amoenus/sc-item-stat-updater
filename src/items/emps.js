const { fmtNum } = require('../lib/formatter');

module.exports = {
  csvFile: 'emps.csv',
  label: 'EMPs',
  descKeyMatch: (kl) => kl.includes('desc') && kl.includes('emp'),
  buildValue(r, flavorText) {
    let val = `Item Type: EMP Generator` +
      `\\nManufacturer: ${r['Manufacturer']}` +
      `\\nSize: ${r['Size']}` +
      `\\n\\n-- EMP Stats --` +
      `\\nDamage: ${fmtNum(r['Dmg'])}` +
      `\\nEMP Radius: ${r['EMP Radius Min']} - ${r['EMP Radius Max']}m` +
      `\\nCharge Time: ${r['Charge Time']}s` +
      `\\nUnleash Time: ${r['Unleash Time']}s` +
      `\\nCooldown: ${r['Cooldown']}s` +
      `\\n\\n-- Power --` +
      `\\nPower Consumption: ${r['Power Consumption']}` +
      `\\n\\n-- Durability --` +
      `\\nHealth: ${fmtNum(r['Health'])}` +
      `\\nDistortion Shutdown Dmg: ${fmtNum(r['Distortion Shutdown Dmg'])}` +
      `\\nDistortion Decay Delay: ${r['Distortion Decay Delay']}s` +
      `\\nDistortion Decay Rate: ${r['Distortion Decay Rate']}` +
      `\\nDistortion Warning Ratio: ${r['Distortion Warning Ratio']}`;

    if (flavorText) val += `\\n\\n${flavorText}`;
    return val;
  },
};
