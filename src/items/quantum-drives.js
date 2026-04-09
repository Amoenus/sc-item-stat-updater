const { fmtNum } = require('../lib/formatter');

module.exports = {
  csvFile: 'quantum_drives.csv',
  label: 'Quantum Drives',
  descKeyMatch: (kl) => kl.includes('descqdrv_') || kl.includes('desc_qdrv_') || kl.includes('desc_qrdv_'),
  buildValue(r, flavorText) {
    let clsLine = r['Class'] ? `\\nClass: ${r['Class']}` : '';
    let val = `Item Type: Quantum Drive` +
      `\\nManufacturer: ${r['Manufacturer']}` +
      `\\nSize: ${r['Size']}` +
      `\\nGrade: ${r['Grade']}` +
      clsLine +
      `\\n\\n-- Drive Stats --` +
      `\\nMax Speed: ${fmtNum(r['Max Speed km/s'])} km/s (${r['Max Speed c']}c)` +
      `\\nSpline Max Speed: ${fmtNum(r['Spline Max Speed km/s'])} km/s` +
      `\\nSpool Up Time: ${r['Spool Up Time']}s` +
      `\\nCooldown Time: ${r['Cooldown Time']}s` +
      `\\nStage 1 Accel: ${fmtNum(r['Stage One Acceleration'])}` +
      `\\nStage 2 Accel: ${fmtNum(r['Stage Two Acceleration'])}` +
      `\\n\\n-- Calibration --` +
      `\\nDelay: ${r['Calibration Delay']}s` +
      `\\nRate: ${fmtNum(r['Calibration Rate'])}` +
      `\\nMin/Max: ${fmtNum(r['Calibration Min'])} / ${fmtNum(r['Calibration Max'])}` +
      `\\nDisconnect Range: ${fmtNum(r['Disconnect Range'])}` +
      `\\n\\n-- Power & Efficiency --` +
      `\\nPower Consumption: ${r['Power Consumption']}` +
      `\\nFuel Requirement: ${r['Quantum Fuel Requirement']}` +
      `\\nEfficiency: ${r['Efficiency']}` +
      `\\nEM Max: ${fmtNum(r['EM Max'])}` +
      `\\n\\n-- Durability & Resistance --` +
      `\\nHealth: ${fmtNum(r['Health'])}` +
      `\\nDistortion Shutdown Dmg: ${fmtNum(r['Distortion Shutdown Dmg'])}` +
      `\\nDistortion Decay Delay: ${r['Distortion Decay Delay']}s` +
      `\\nDistortion Decay Rate: ${r['Distortion Decay Rate']}` +
      `\\nDistortion Warning Ratio: ${r['Distortion Warning Ratio']}` +
      `\\nInterdiction Effect Time: ${r['Interdiction Effect Time']}s`;

    if (flavorText) val += `\\n\\n${flavorText}`;
    return val;
  },
};
