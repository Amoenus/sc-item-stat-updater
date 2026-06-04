import { stat } from '../../enrichment/stat-builder';
import type { ItemConfig } from '../../enrichment/item-config';

export default {
  csvFile: 'quantuminterdictiongenerator.spviewer.csv',
  label: 'SP QEDs',
  nameColumn: 'Name',
  requiredColumns: ['Name', 'Manufacturer', 'Range Jamming', 'Range Interdiction'],
  descKeyMatch: (kl) => kl.includes('descqdmp_') || kl.includes('descqed_'),
  buildValue(r, flavorText) {
    const hasSnare = r['Range Interdiction'] && r['Range Interdiction'] !== '0';

    const s = stat(r)
      .line('Item Type', hasSnare ? 'Quantum Enforcement Device' : 'Quantum Dampener')
      .raw('Manufacturer', 'Manufacturer')
      .rawIf('Size', 'Size')
      .section('-- QED Stats --')
      .raw('Jammer Range', 'Range Jamming');

    if (hasSnare) {
      s.raw('Interdiction Range', 'Range Interdiction');
    }

    s.rawIf('Charge Delay', 'Interdiction Usage Delay Charge')
      .rawIf('Activation Delay', 'Interdiction Usage Delay Activation')
      .rawIf('Cooldown', 'Interdiction Usage Delay Cooldown');

    s.section('-- Emission --').rawIf('EM Active', 'EM Emit Active').rawIf('IR', 'IR Emit');

    s.section('-- Power --')
      .rawIf('Power Active', 'Power Segment Usage Active')
      .rawIf('Power Min', 'Power Segment Usage Min');

    return s.build(flavorText);
  },
} satisfies ItemConfig;
