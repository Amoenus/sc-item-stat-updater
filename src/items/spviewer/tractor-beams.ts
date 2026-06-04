import { stat } from '../../enrichment/stat-builder';
import type { ItemConfig } from '../../lib/types';
import { addEmissionAndDurabilityStats } from './shared-stat-sections';

export default {
  csvFile: 'tractorbeam.spviewer.csv',
  label: 'SP Tractor Beams',
  nameColumn: 'Name',
  requiredColumns: ['Name', 'Manufacturer', 'Size', 'Tractor Force (MN)', 'Tractor Range', 'Health'],
  descKeyMatch: (kl) => kl.includes('desc') && kl.includes('tractorbeam'),
  buildValue(r, flavorText) {
    return addEmissionAndDurabilityStats(
      stat(r)
        .line('Item Type', 'Tractor Beam')
        .raw('Manufacturer', 'Manufacturer')
        .raw('Size', 'Size')
        .section('-- Tractor Stats --')
        .raw('Force', 'Tractor Force (MN)', ' MN')
        .raw('Range', 'Tractor Range')
        .rawIf('Full Strength Distance', 'Tractor Full Strength Dist.')
        .rawIf('Max Angle', 'Tractor Max Angle')
        .rawIf('Max Volume', 'Tractor Max Volume')
        .section('-- Towing --')
        .rawIf('Tow Force', 'Towing Force (MN)', ' MN')
        .rawIf('Max Accel', 'Towing Max Accel. (m/s²)', ' m/s²')
        .rawIf('Max Distance', 'Towing Max Distance')
        .rawIf('QT Mass Limit', 'Towing QT Mass Limit'),
    ).build(flavorText);
  },
} satisfies ItemConfig;
