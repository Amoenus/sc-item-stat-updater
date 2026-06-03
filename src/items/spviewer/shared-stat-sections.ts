import type { StatBuilder } from '../../lib/format/stat-builder';

export function addEmissionAndDurabilityStats(builder: StatBuilder): StatBuilder {
  return builder
    .section('-- Emission --')
    .rawIf('EM Active', 'EM Emit Active')
    .rawIf('IR', 'IR Emit')
    .section('-- Durability --')
    .raw('Health', 'Health')
    .rawIf('Distortion Shutdown', 'Distortion Resistance Shutdown Dmg');
}
