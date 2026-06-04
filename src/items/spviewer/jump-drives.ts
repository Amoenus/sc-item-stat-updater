import { stat } from '../../enrichment/stat-builder';
import type { ItemConfig } from '../../enrichment/item-config';
import { addEmissionAndDurabilityStats } from './shared-stat-sections';

export default {
  csvFile: 'jumpdrive.spviewer.csv',
  label: 'SP Jump Drives',
  nameColumn: 'Name',
  requiredColumns: ['Name', 'Manufacturer', 'Size', 'Grade', 'Health'],
  descKeyMatch: (kl) => kl.includes('desc') && kl.includes('jdrv'),
  buildValue(r, flavorText) {
    return addEmissionAndDurabilityStats(
      stat(r)
        .line('Item Type', 'Jump Drive')
        .raw('Manufacturer', 'Manufacturer')
        .raw('Size', 'Size')
        .raw('Grade', 'Grade')
        .lineIf('Class', r['Class'])
        .section('-- Jump Drive Stats --')
        .rawIf('Alignment Rate', 'Jump Drive Characteristics Alignment Rate')
        .rawIf('Alignment Decay', 'Jump Drive Characteristics Alignment Decay Rate')
        .rawIf('Tuning Rate', 'Jump Drive Characteristics Tuning Rate')
        .rawIf('Tuning Decay', 'Jump Drive Characteristics Tuning Decay Rate')
        .rawIf('Fuel Usage Multiplier', 'Jump Drive Characteristics Fuel Usage Multiplier'),
    ).build(flavorText);
  },
} satisfies ItemConfig;
