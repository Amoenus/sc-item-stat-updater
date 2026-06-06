import { loadMissionConfigs } from '../../items/registry';
import type { UpdateProvider } from './prepare-update-categories';
import { getUpdateExtraStepLabels, type UpdateExtraStepLabel } from './run-update-extra-steps';

export type ScmdbDependencyClassification =
  | 'Already extractable from DataCore'
  | 'Probably extractable from DataCore with new graph traversal'
  | 'SCMDB-only derived/generated'
  | 'Unknown, needs investigation';

export type ScmdbDependencyKind = 'update category' | 'extra step' | 'generated source step';

export interface ScmdbDependencyAuditEntry {
  kind: ScmdbDependencyKind;
  slug: string;
  label: string;
  sourceFiles: string[];
  classification: ScmdbDependencyClassification;
  reason: string;
  migrationSlice: string;
  activeForDatacoreProvider: boolean;
}

export interface ScmdbDependencyAudit {
  sourceHierarchy: string[];
  entries: ScmdbDependencyAuditEntry[];
}

const MISSION_CLASSIFICATIONS: Record<
  string,
  Pick<ScmdbDependencyAuditEntry, 'classification' | 'reason' | 'migrationSlice'>
> = {
  'mission-commodities': {
    classification: 'Already extractable from DataCore',
    reason:
      'DataCore commodities now supply commodity entity keys, explicit carryable commodity localization keys, first-party harvestable base aliases such as Armillaria and Molina Mold, and first-party hauling entity class labels for salvage component orders. The active commodity loader no longer reads SCMDB resource pools; generic LOC_PLACEHOLDER resource-pool entries are ignored as placeholder noise.',
    migrationSlice:
      'Retired for commodities; keep SCMDB resource pools out of active commodity loading unless a first-party gap is proven and documented as a temporary bridge.',
  },
  'mission-mining-elements': {
    classification: 'Probably extractable from DataCore with new graph traversal',
    reason:
      'DataCore now supplies core mining behavior facts, material labels, asteroid/surface scan signatures, rarity from mineable rock variants where present, and quality bands from quality quantization records. SCMDB cannot create active mining-element target rows; it only joins bridge fields onto DataCore rows. SCMDB still contributes density, best-refinery bonus joins, and unreconstructed ground scan fallbacks; the current DataCore refiningprocess records define only global process speed/quality labels, not station/material bonus profiles.',
    migrationSlice:
      'Extend DataCore mining extraction to density, ground scan, and refinery joins if first-party fields are found. Density investigation should avoid carryable Mass/SCU because it does not match SCMDB density values, and refinery replacement should not infer SCMDB profile IDs unless a station/material bonus source is proven.',
  },
  'mission-mining-locations': {
    classification: 'Already extractable from DataCore',
    reason:
      'DataCore mining provider, composition, quality, entity, clustering, sub-harvestable, and parameter CSVs now drive mining location summaries, including the former Breaker Station and Hathor special-site pools. SCMDB mining-locations.csv is no longer read by this category.',
    migrationSlice:
      'Retired for mining locations; keep watching mining-journal.csv separately for journal rarity labels.',
  },
  'mission-mining-journal': {
    classification: 'SCMDB-only derived/generated',
    reason:
      'DataCore mining records contain rarity-named buckets in class/path names, but no explicit per-element journal rarity field has been found in the generated DataCore artifacts. The probability-based DataCore diagnostic does not match SCMDB closely enough, so SCMDB remains authoritative for journal rarity labels; DataCore journal use is limited to separately rendered insight summaries.',
    migrationSlice:
      'Keep SCMDB mining-journal.csv for journal rarity labels; use DataCore mining facts only for separately proven diagnostics and insights.',
  },
  'mission-scmdb-descriptions': {
    classification: 'Probably extractable from DataCore with new graph traversal',
    reason:
      'Mission descriptions are currently sourced from SCMDB contracts enriched with cooldowns, encounters, hauling details, blueprint rewards, and item reward joins.',
    migrationSlice:
      'Build a first-party mission/contract extractor and reproduce SCMDB contract metadata joins from DataCore records.',
  },
  'mission-scmdb-titles': {
    classification: 'Probably extractable from DataCore with new graph traversal',
    reason:
      'Mission titles and chain tags currently come from the SCMDB mission CSV; title localization keys may be recoverable from mission/contract records.',
    migrationSlice: 'Extract mission title keys and blueprint/intro chain markers from DataCore mission records.',
  },
};

const EXTRA_STEP_CLASSIFICATIONS: Record<
  UpdateExtraStepLabel,
  Pick<ScmdbDependencyAuditEntry, 'classification' | 'reason' | 'migrationSlice'> | undefined
> = {
  'Component Titles': undefined,
  'FPS title tags': undefined,
  'Missile title tags': undefined,
  'Raw commodity labels': undefined,
  'Adagio location tags (experimental)': undefined,
  'Mining journal': {
    classification: 'SCMDB-only derived/generated',
    reason:
      'The optional extra step can generate DataCore insight summaries from mining facts, but the inferred rarity buckets do not match SCMDB and no explicit first-party journal rarity field has been found. SCMDB remains the rendered journal rarity source.',
    migrationSlice: 'Keep SCMDB as the journal rarity source; limit DataCore journal usage to proven insights.',
  },
};

function sourceFilesFromConfig(config: {
  csvFile?: string;
  jsonFile?: string;
  lookupCsvFile?: string;
  sourceFiles?: Array<{ file: string; sourceDir?: string }>;
  resolveJsonFile?: unknown;
  loadSourceData?: unknown;
}): string[] {
  const usesDeclaredCustomSources = Boolean(config.loadSourceData && config.sourceFiles?.length);
  const staticFiles = [
    usesDeclaredCustomSources ? undefined : config.csvFile,
    config.jsonFile,
    config.lookupCsvFile,
  ].filter((file): file is string => Boolean(file));
  const companionFiles =
    config.sourceFiles?.map((sourceFile) =>
      sourceFile.sourceDir && sourceFile.sourceDir !== 'csvDir'
        ? `${sourceFile.sourceDir}:${sourceFile.file}`
        : sourceFile.file,
    ) ?? [];
  const dynamicJson = config.resolveJsonFile ? ['dynamic SCMDB JSON: merged-*.json'] : [];
  return [...staticFiles, ...dynamicJson, ...companionFiles];
}

function generatedMiningLocationsEntry(): ScmdbDependencyAuditEntry {
  return {
    kind: 'generated source step',
    slug: 'regen-mining-locations',
    label: 'Regenerate mining-locations.csv',
    sourceFiles: ['mining_data.json', 'mining_data-*.json'],
    classification: 'SCMDB-only derived/generated',
    reason:
      'The standalone regen-mining-locations CLI can still rebuild mining-locations.csv from SCMDB mining_data for manual legacy comparison, but active DataCore mining location updates and update-all no longer read or refresh that generated CSV.',
    migrationSlice:
      'Retain only as manual legacy comparison tooling until no comparison workflow depends on mining-locations.csv.',
    activeForDatacoreProvider: false,
  };
}

export async function buildScmdbDependencyAudit(
  options: { provider?: UpdateProvider } = {},
): Promise<ScmdbDependencyAudit> {
  const provider = options.provider ?? 'datacore';
  const missionConfigs = await loadMissionConfigs();
  const entries: ScmdbDependencyAuditEntry[] = [];

  for (const [slug, config] of [...missionConfigs.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const classification = MISSION_CLASSIFICATIONS[slug] ?? {
      classification: 'Unknown, needs investigation' as const,
      reason: 'No SCMDB migration classification has been recorded for this mission category yet.',
      migrationSlice: 'Audit the category loader and classify its SCMDB fields against DataCore records.',
    };
    entries.push({
      kind: 'update category',
      slug,
      label: config.label,
      sourceFiles: sourceFilesFromConfig(config),
      ...classification,
      activeForDatacoreProvider: provider === 'datacore' && config.skip !== true,
    });
  }

  entries.push(generatedMiningLocationsEntry());

  for (const label of getUpdateExtraStepLabels({ includeMiningJournal: true })) {
    const classification = EXTRA_STEP_CLASSIFICATIONS[label];
    if (!classification) continue;
    entries.push({
      kind: 'extra step',
      slug: label
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, '-')
        .replaceAll(/^-|-$/g, ''),
      label,
      sourceFiles: [
        'datacore:mining-elements.datacore.csv',
        'datacore:mining-compositions.datacore.csv',
        'datacore:mining-quality-distributions.datacore.csv',
        'fallback:mining-journal.csv',
      ],
      ...classification,
      activeForDatacoreProvider: false,
    });
  }

  return {
    sourceHierarchy: [
      'DataCore/Data.p4k: authoritative source for game-derived raw facts.',
      'SCMDB: temporary bridge for derived/generated mission, blueprint, crafting, and mining aggregations not yet reconstructed from DataCore.',
      'SPViewer: legacy comparison/audit source only.',
    ],
    entries,
  };
}

export function formatScmdbDependencyAudit(audit: ScmdbDependencyAudit): string {
  const lines = [
    'SCMDB dependency audit',
    '',
    'Source hierarchy:',
    ...audit.sourceHierarchy.map((line) => `  ${line}`),
    '',
    '| Kind | Dependency | Files | Classification | DataCore provider? | Migration slice |',
    '| --- | --- | --- | --- | --- | --- |',
  ];

  for (const entry of audit.entries) {
    lines.push(
      `| ${entry.kind} | ${entry.slug} (${entry.label}) | ${entry.sourceFiles.join(', ') || 'none declared'} | ${
        entry.classification
      } | ${entry.activeForDatacoreProvider ? 'yes' : 'no'} | ${entry.migrationSlice} |`,
    );
  }

  lines.push('', 'Why SCMDB is still used:');
  for (const entry of audit.entries) {
    lines.push(`  ${entry.slug}: ${entry.reason}`);
  }

  return lines.join('\n');
}
