import type { ItemConfig } from '../../enrichment/item-config';
import { buildPatchPlanResult } from './build-patch-plan';

export type ComparableProvider = 'datacore' | 'spviewer';

export interface ProviderComparisonInput {
  category: string;
  iniPath: string;
  datacore: {
    config: ItemConfig;
    csvDir: string;
  };
  spviewer: {
    config: ItemConfig;
    csvDir: string;
  };
}

export interface ProviderOnlyKey {
  key: string;
  value: string;
}

export interface ProviderChangedValue {
  key: string;
  datacoreValue: string;
  spviewerValue: string;
}

export interface ProviderOutputComparison {
  category: string;
  counts: {
    datacoreKeys: number;
    spviewerKeys: number;
    commonKeys: number;
    changedValues: number;
    datacoreOnly: number;
    spviewerOnly: number;
  };
  datacoreOnly: ProviderOnlyKey[];
  spviewerOnly: ProviderOnlyKey[];
  changedValues: ProviderChangedValue[];
}

function entriesByKey(entries: Array<{ key: string; value: string }>): Map<string, string> {
  return new Map(entries.map((entry) => [entry.key, entry.value]));
}

export async function compareProviderCategoryOutputs(
  input: ProviderComparisonInput,
): Promise<ProviderOutputComparison> {
  const [datacorePlan, spviewerPlan] = await Promise.all([
    buildPatchPlanResult(input.datacore.config, {
      csvDir: input.datacore.csvDir,
      iniPath: input.iniPath,
      dryRun: true,
      force: true,
    }),
    buildPatchPlanResult(input.spviewer.config, {
      csvDir: input.spviewer.csvDir,
      iniPath: input.iniPath,
      dryRun: true,
      force: true,
    }),
  ]);

  const datacoreEntries = entriesByKey(datacorePlan.plan.entries);
  const spviewerEntries = entriesByKey(spviewerPlan.plan.entries);
  const commonKeys = [...datacoreEntries.keys()].filter((key) => spviewerEntries.has(key));
  const datacoreOnly = [...datacoreEntries.entries()]
    .filter(([key]) => !spviewerEntries.has(key))
    .map(([key, value]) => ({ key, value }));
  const spviewerOnly = [...spviewerEntries.entries()]
    .filter(([key]) => !datacoreEntries.has(key))
    .map(([key, value]) => ({ key, value }));
  const changedValues = commonKeys
    .filter((key) => datacoreEntries.get(key) !== spviewerEntries.get(key))
    .map((key) => ({
      key,
      datacoreValue: datacoreEntries.get(key) ?? '',
      spviewerValue: spviewerEntries.get(key) ?? '',
    }));

  return {
    category: input.category,
    counts: {
      datacoreKeys: datacoreEntries.size,
      spviewerKeys: spviewerEntries.size,
      commonKeys: commonKeys.length,
      changedValues: changedValues.length,
      datacoreOnly: datacoreOnly.length,
      spviewerOnly: spviewerOnly.length,
    },
    datacoreOnly,
    spviewerOnly,
    changedValues,
  };
}

function sampleKeys<T extends { key: string }>(entries: T[], maxKeys: number): string {
  if (entries.length === 0) return 'none';
  const shown = entries.slice(0, maxKeys).map((entry) => entry.key);
  const suffix = entries.length > maxKeys ? `, ...and ${entries.length - maxKeys} more` : '';
  return `${shown.join(', ')}${suffix}`;
}

export function formatProviderOutputComparison(
  comparison: ProviderOutputComparison,
  options: { maxKeys?: number } = {},
): string {
  const maxKeys = options.maxKeys ?? 5;
  return [
    `Provider comparison: ${comparison.category}`,
    `  DataCore keys: ${comparison.counts.datacoreKeys}`,
    `  SPViewer keys: ${comparison.counts.spviewerKeys}`,
    `  Common keys:   ${comparison.counts.commonKeys}`,
    `  Changed values: ${comparison.counts.changedValues} (${sampleKeys(comparison.changedValues, maxKeys)})`,
    `  DataCore only:  ${comparison.counts.datacoreOnly} (${sampleKeys(comparison.datacoreOnly, maxKeys)})`,
    `  SPViewer only:  ${comparison.counts.spviewerOnly} (${sampleKeys(comparison.spviewerOnly, maxKeys)})`,
  ].join('\n');
}
