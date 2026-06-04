import type { ItemConfig } from '../../lib/types';
import { buildPatchData } from '../../lib/updater';
import type { PatchPlan } from '../../pipeline/types';

export interface BuildPatchPlanOptions {
  iniPath?: string;
  csvDir?: string;
  force?: boolean;
}

export async function buildPatchPlan(config: ItemConfig, options: BuildPatchPlanOptions = {}): Promise<PatchPlan> {
  const data = await buildPatchData(config, options);
  return data.plan;
}
