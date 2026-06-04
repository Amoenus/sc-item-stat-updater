import type { PatchPlan, UpdateIssue } from '../pipeline/types';

export function createPatchPlan(entries: PatchPlan['entries'], issues: UpdateIssue[] = []): PatchPlan {
  return { entries, issues };
}

export function patchMapToEntries(
  patches: Record<string, string>,
  source: string,
  reason = 'Existing updater patch',
): PatchPlan['entries'] {
  return Object.entries(patches).map(([key, value]) => ({ key, value, source, reason }));
}
