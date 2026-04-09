const { fmtNum } = require('../lib/formatter');

module.exports = {
  csvFile: 'tractor_beams.csv',
  label: 'Tractor Beams',
  descKeyMatch: (kl) => kl.includes('desc') && kl.includes('tractorbeam'),
  buildValue(r, flavorText) {
    let val = `Item Type: Tractor Beam` +
      `\\nManufacturer: ${r['Manufacturer']}` +
      `\\nSize: ${r['Size']}` +
      `\\n\\n-- Tractor Beam Stats --` +
      `\\nMax Force: ${fmtNum(r['Max Force'])}N` +
      `\\nMin Force: ${r['Min Force']}N` +
      `\\nMax Distance: ${r['Max Distance']}m` +
      `\\nMin Distance: ${r['Min Distance']}m` +
      `\\nFull Strength Distance: ${r['Full Strength Distance']}m` +
      `\\nMax Angle: ${r['Max Angle']}°` +
      `\\n\\n-- Power & Durability --` +
      `\\nPower Consumption: ${r['Power Consumption']}` +
      `\\nHealth: ${fmtNum(r['Health'])}`;

    if (flavorText) val += `\\n\\n${flavorText}`;
    return val;
  },
};
