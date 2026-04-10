// @ts-check
import { fmtNum, stat } from '../lib/stat-builder.js';

/** @type {import('../lib/types.js').ItemConfig} */
export default {
  csvFile: 'quantum_drives.csv',
  label: 'Quantum Drives',
  requiredColumns: [
    'Localization Key',
    'Manufacturer',
    'Size',
    'Grade',
    'Class',
    'Max Speed km/s',
    'Max Speed c',
    'Spline Max Speed km/s',
    'Spool Up Time',
    'Cooldown Time',
    'Stage One Acceleration',
    'Stage Two Acceleration',
    'Calibration Delay',
    'Calibration Rate',
    'Calibration Min',
    'Calibration Max',
    'Disconnect Range',
    'Power Consumption',
    'Quantum Fuel Requirement',
    'Efficiency',
    'EM Max',
    'Health',
    'Distortion Shutdown Dmg',
    'Distortion Decay Delay',
    'Distortion Decay Rate',
    'Distortion Warning Ratio',
    'Interdiction Effect Time',
  ],
  descKeyMatch: (kl) => kl.includes('descqdrv_') || kl.includes('desc_qdrv_') || kl.includes('desc_qrdv_'),
  buildValue(r, flavorText) {
    return stat(r)
      .line('Item Type', 'Quantum Drive')
      .raw('Manufacturer', 'Manufacturer')
      .raw('Size', 'Size')
      .raw('Grade', 'Grade')
      .lineIf('Class', r['Class'])
      .section('-- Drive Stats --')
      .line('Max Speed', `${fmtNum(r['Max Speed km/s'])} km/s (${r['Max Speed c']}c)`)
      .num('Spline Max Speed', 'Spline Max Speed km/s', ' km/s')
      .raw('Spool Up Time', 'Spool Up Time', 's')
      .raw('Cooldown Time', 'Cooldown Time', 's')
      .num('Stage 1 Accel', 'Stage One Acceleration')
      .num('Stage 2 Accel', 'Stage Two Acceleration')
      .section('-- Calibration --')
      .raw('Delay', 'Calibration Delay', 's')
      .num('Rate', 'Calibration Rate')
      .line('Min/Max', `${fmtNum(r['Calibration Min'])} / ${fmtNum(r['Calibration Max'])}`)
      .num('Disconnect Range', 'Disconnect Range')
      .section('-- Power & Efficiency --')
      .raw('Power Consumption', 'Power Consumption')
      .raw('Fuel Requirement', 'Quantum Fuel Requirement')
      .raw('Efficiency', 'Efficiency')
      .num('EM Max', 'EM Max')
      .section('-- Durability & Resistance --')
      .num('Health', 'Health')
      .num('Distortion Shutdown Dmg', 'Distortion Shutdown Dmg')
      .raw('Distortion Decay Delay', 'Distortion Decay Delay', 's')
      .raw('Distortion Decay Rate', 'Distortion Decay Rate')
      .raw('Distortion Warning Ratio', 'Distortion Warning Ratio')
      .raw('Interdiction Effect Time', 'Interdiction Effect Time', 's')
      .build(flavorText);
  },
};
