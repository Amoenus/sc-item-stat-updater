import type { ItemConfig } from '../../lib/types';
import { runUpdate } from '../../lib/updater';

export interface EnrichGlobalIniOptions {
  iniPath?: string;
  csvDir?: string;
  dryRun?: boolean;
  skipBackup?: boolean;
  force?: boolean;
}

export function enrichGlobalIni(config: ItemConfig, options: EnrichGlobalIniOptions = {}) {
  return runUpdate(config, options);
}
