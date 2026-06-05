import path from 'node:path';
import type { ItemConfig } from '../../enrichment/item-config';
import { loadDatacoreConfigs, loadSpviewerConfigs } from '../../items/registry';
import { resolveLatestVersionDir, type UpdateChannel } from './prepare-update-categories';
import { buildPatchPlanResult } from './build-patch-plan';
import { compareProviderCategoryOutputs, type ProviderOutputComparison } from './provider-output-comparison';

export type SpviewerRetirementDecision = 'retire' | 'keep-active';

export interface SpviewerRetirementAuditCategory {
  category: string;
  spviewerSlug: string;
  datacoreSlug?: string;
  status: 'covered' | 'missing-datacore-category' | 'comparison-failed';
  blockingReasons: string[];
  reviewNotes: string[];
  comparison?: ProviderOutputComparison;
  crossCategoryDatacoreKeys?: Array<{ key: string; datacoreSlug: string }>;
  nonBlockingSpviewerOnlyKeys?: Array<{ key: string; reason: string }>;
  error?: string;
}

export interface SpviewerRetirementAudit {
  decision: SpviewerRetirementDecision;
  channel: UpdateChannel;
  datacoreDir: string;
  spviewerDir: string;
  iniPath: string;
  counts: {
    spviewerCategories: number;
    datacoreMatchedCategories: number;
    missingDatacoreCategories: number;
    comparisonFailures: number;
    categoriesWithSpviewerOnlyKeys: number;
    categoriesWithChangedValues: number;
    categoriesBlockingRetirement: number;
    categoriesNeedingReview: number;
  };
  categories: SpviewerRetirementAuditCategory[];
}

export interface BuildSpviewerRetirementAuditOptions {
  repoRoot: string;
  iniPath?: string;
  datacoreDir?: string;
  spviewerDir?: string;
  ptu?: boolean;
}

function stripProviderPrefix(slug: string): string {
  return slug.replace(/^(?:dc|sp)-/, '');
}

function categoryLabel(config: ItemConfig): string {
  return config.label.replace(/^(?:DC|SP) /, '');
}

const NON_BLOCKING_SPVIEWER_ONLY_KEYS: Record<string, Record<string, string>> = {
  'mining-lasers': {
    item_Mining_MiningLaser_Greycat_Default_SV_Desc:
      'SPViewer-only Greycat vehicle/mining-laser legacy key; no active DataCore item-stat gap for SPViewer retirement',
  },
  'mining-modifiers': {
    item_Mining_Gadget_Gadget1_Desc:
      'SPViewer-only legacy mining gadget key; current active DataCore mining modifier rows do not require it for retirement',
    item_Mining_Gadget_Gadget2_Desc:
      'SPViewer-only legacy mining gadget key; current active DataCore mining modifier rows do not require it for retirement',
    item_Mining_Gadget_Gadget3_Desc:
      'SPViewer-only legacy mining gadget key; current active DataCore mining modifier rows do not require it for retirement',
    item_Mining_Gadget_Gadget4_Desc:
      'SPViewer-only legacy mining gadget key; current active DataCore mining modifier rows do not require it for retirement',
    item_Mining_Gadget_Gadget5_Desc:
      'SPViewer-only legacy mining gadget key; current active DataCore mining modifier rows do not require it for retirement',
    item_Mining_Gadget_Gadget6_Desc:
      'SPViewer-only legacy mining gadget key; current active DataCore mining modifier rows do not require it for retirement',
  },
  'missile-launchers': {
    item_DescAEGS_Idris_Rack:
      'SPViewer-only generic Idris missile rack mapping/global.ini key; no matching current DataCore missile-launcher row in 4.8.1.11875683 data',
  },
  shields: {
    item_DescSHLD_S01_CIV_SECO_Ink:
      'SPViewer/global.ini legacy shield key; current DataCore shield row emits item_DescSHLD_SECO_S01_INK',
    item_DescSHLD_ASAS_S01_Obscura:
      'SPViewer/global.ini legacy S1 Obscura key; current DataCore shield row emits S2 Obscura',
    item_DescSHLD_S01_CMP_YORM_Targa:
      'SPViewer/global.ini legacy shield key; current DataCore shield row emits item_DescSHLD_YORM_S01_Targa',
  },
  turrets: {
    item_DescDRAK_Fixed_Mount_S4:
      'DataCore raw fixed-mount record exists under scitem/ships/weapon_mounts/fixed; SPViewer legacy turret category boundary',
    item_DescMustang_Nose_Scoop:
      'DataCore raw ship module record exists under scitem/ships/module; SPViewer legacy turret category boundary',
    item_DescUMNT_MISC_S03_PL01:
      'DataCore raw fixed-mount record exists under scitem/ships/weapon_mounts/fixed; SPViewer legacy turret category boundary',
    item_DescDefault_Fixed_Mount_S3:
      'DataCore raw fixed-mount record exists under scitem/ships/weapon_mounts/fixed; SPViewer legacy turret category boundary',
    item_DescDefault_Fixed_Mount_S4:
      'DataCore raw fixed-mount record exists under scitem/ships/weapon_mounts/fixed; SPViewer legacy turret category boundary',
    item_DescANVL_Fixed_Mount_Hornet_Ball_S4:
      'DataCore raw fixed-mount record exists under scitem/ships/weapon_mounts/fixed; SPViewer legacy turret category boundary',
    item_DescAEGS_Idris_Large_Turret:
      'SPViewer resolves generic name "Turret" through a stale saved mapping; DataCore emits current Idris turret keys',
  },
  'weapon-guns': {
    item_DescKRNG_LaserCannon_S4:
      'SPViewer resolves FL-33 through a stale legacy KRNG S4 localization key; current DataCore weapon row emits KRON S3',
    item_DescKLWE_MassDriverCannon_S2:
      'SPViewer/global.ini legacy Sledge II Cannon key; current DataCore weapon row emits item_DescKLWE_MassDriver_S2',
  },
};

function getNonBlockingSpviewerOnlyKeys(
  category: string,
  comparison: ProviderOutputComparison,
): Array<{ key: string; reason: string }> {
  const classifications = NON_BLOCKING_SPVIEWER_ONLY_KEYS[category] ?? {};
  return comparison.spviewerOnly.flatMap((entry) => {
    const reason = classifications[entry.key];
    return reason ? [{ key: entry.key, reason }] : [];
  });
}

function getBlockingReasons(
  comparison: ProviderOutputComparison,
  crossCategoryDatacoreKeys: Array<{ key: string }>,
  nonBlockingSpviewerOnlyKeys: Array<{ key: string }>,
): string[] {
  const reasons: string[] = [];
  const nonBlockingKeys = new Set(
    [...crossCategoryDatacoreKeys, ...nonBlockingSpviewerOnlyKeys].map((entry) => entry.key.toLowerCase()),
  );
  const blockingSpviewerOnly = comparison.spviewerOnly.filter(
    (entry) => !nonBlockingKeys.has(entry.key.toLowerCase()),
  ).length;
  if (blockingSpviewerOnly > 0) {
    reasons.push(`${blockingSpviewerOnly} SPViewer-only generated localization key(s)`);
  }
  return reasons;
}

function getReviewNotes(comparison: ProviderOutputComparison): string[] {
  const notes: string[] = [];
  if (comparison.counts.changedValues > 0) {
    notes.push(
      `${comparison.counts.changedValues} generated value difference(s) to sample for DataCore extraction bugs`,
    );
  }
  return notes;
}

async function buildDatacoreKeyCoverage(
  datacoreConfigs: Map<string, ItemConfig>,
  options: { csvDir: string; iniPath: string },
): Promise<Map<string, string>> {
  const coverage = new Map<string, string>();
  await Promise.all(
    [...datacoreConfigs.entries()]
      .filter(([, config]) => !config.skip)
      .map(async ([slug, config]) => {
        try {
          const planResult = await buildPatchPlanResult(config, {
            csvDir: options.csvDir,
            iniPath: options.iniPath,
            dryRun: true,
          });
          for (const entry of planResult.plan.entries) {
            if (!coverage.has(entry.key)) coverage.set(entry.key, slug);
          }
        } catch {
          // Per-category comparison below reports source-specific failures.
        }
      }),
  );
  return coverage;
}

export async function buildSpviewerRetirementAudit(
  options: BuildSpviewerRetirementAuditOptions,
): Promise<SpviewerRetirementAudit> {
  const channel: UpdateChannel = options.ptu ? 'PTU' : 'LIVE';
  const datacoreDir =
    options.datacoreDir ??
    (await resolveLatestVersionDir(
      path.join(options.repoRoot, 'csv', 'datacore'),
      options.ptu ?? false,
      'DataCore',
      'scrape-datacore.js',
    ));
  const spviewerDir =
    options.spviewerDir ??
    (await resolveLatestVersionDir(
      path.join(options.repoRoot, 'csv', 'spviewer'),
      options.ptu ?? false,
      'SPViewer',
      'scrape-spviewer.js',
    ));
  const iniPath = options.iniPath ?? path.join(options.repoRoot, 'global.ini');
  const [spviewerConfigs, datacoreConfigs] = await Promise.all([loadSpviewerConfigs(), loadDatacoreConfigs()]);
  const datacoreKeyCoverage = await buildDatacoreKeyCoverage(datacoreConfigs, { csvDir: datacoreDir, iniPath });
  const datacoreByBaseSlug = new Map(
    [...datacoreConfigs.entries()].map(([slug, config]) => [stripProviderPrefix(slug), { slug, config }]),
  );

  const categories = await Promise.all(
    [...spviewerConfigs.entries()]
      .filter(([, config]) => !config.skip)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(async ([spviewerSlug, spviewerConfig]): Promise<SpviewerRetirementAuditCategory> => {
        const baseSlug = stripProviderPrefix(spviewerSlug);
        const datacore = datacoreByBaseSlug.get(baseSlug);
        if (!datacore) {
          return {
            category: categoryLabel(spviewerConfig),
            spviewerSlug,
            status: 'missing-datacore-category',
            blockingReasons: ['no matching DataCore category'],
            reviewNotes: [],
          };
        }

        try {
          const comparison = await compareProviderCategoryOutputs({
            category: baseSlug,
            iniPath,
            datacore: { config: datacore.config, csvDir: datacoreDir },
            spviewer: { config: spviewerConfig, csvDir: spviewerDir },
          });
          const crossCategoryDatacoreKeys = comparison.spviewerOnly
            .map((entry) => ({ key: entry.key, datacoreSlug: datacoreKeyCoverage.get(entry.key) ?? '' }))
            .filter((entry) => entry.datacoreSlug && entry.datacoreSlug !== datacore.slug);
          const nonBlockingSpviewerOnlyKeys = getNonBlockingSpviewerOnlyKeys(baseSlug, comparison);
          const blockingReasons = getBlockingReasons(
            comparison,
            crossCategoryDatacoreKeys,
            nonBlockingSpviewerOnlyKeys,
          );
          const reviewNotes = getReviewNotes(comparison);
          return {
            category: categoryLabel(datacore.config),
            spviewerSlug,
            datacoreSlug: datacore.slug,
            status: 'covered',
            blockingReasons,
            reviewNotes,
            comparison,
            crossCategoryDatacoreKeys,
            nonBlockingSpviewerOnlyKeys,
          };
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          return {
            category: categoryLabel(datacore.config),
            spviewerSlug,
            datacoreSlug: datacore.slug,
            status: 'comparison-failed',
            blockingReasons: ['provider output comparison failed'],
            reviewNotes: [],
            error,
          };
        }
      }),
  );

  const counts = {
    spviewerCategories: categories.length,
    datacoreMatchedCategories: categories.filter((entry) => entry.datacoreSlug).length,
    missingDatacoreCategories: categories.filter((entry) => entry.status === 'missing-datacore-category').length,
    comparisonFailures: categories.filter((entry) => entry.status === 'comparison-failed').length,
    categoriesWithSpviewerOnlyKeys: categories.filter((entry) => (entry.comparison?.counts.spviewerOnly ?? 0) > 0)
      .length,
    categoriesWithChangedValues: categories.filter((entry) => (entry.comparison?.counts.changedValues ?? 0) > 0).length,
    categoriesBlockingRetirement: categories.filter((entry) => entry.blockingReasons.length > 0).length,
    categoriesNeedingReview: categories.filter((entry) => entry.reviewNotes.length > 0).length,
  };

  return {
    decision: counts.categoriesBlockingRetirement === 0 ? 'retire' : 'keep-active',
    channel,
    datacoreDir,
    spviewerDir,
    iniPath,
    counts,
    categories,
  };
}

function sampleKeys<T extends { key: string }>(entries: T[] | undefined, maxKeys: number): string {
  if (!entries || entries.length === 0) return 'none';
  const shown = entries.slice(0, maxKeys).map((entry) => entry.key);
  const suffix = entries.length > maxKeys ? `, ...and ${entries.length - maxKeys} more` : '';
  return `${shown.join(', ')}${suffix}`;
}

export function formatSpviewerRetirementAudit(
  audit: SpviewerRetirementAudit,
  options: { maxKeys?: number } = {},
): string {
  const maxKeys = options.maxKeys ?? 3;
  const lines = [
    'SPViewer retirement audit',
    `Decision: ${audit.decision === 'retire' ? 'SPViewer can be retired from active provider selection' : 'keep SPViewer active for now'}`,
    `Channel: ${audit.channel}`,
    `DataCore: ${audit.datacoreDir}`,
    `SPViewer: ${audit.spviewerDir}`,
    `INI: ${audit.iniPath}`,
    '',
    `SPViewer categories: ${audit.counts.spviewerCategories}`,
    `Matched DataCore categories: ${audit.counts.datacoreMatchedCategories}`,
    `Missing DataCore categories: ${audit.counts.missingDatacoreCategories}`,
    `Comparison failures: ${audit.counts.comparisonFailures}`,
    `Categories with SPViewer-only keys: ${audit.counts.categoriesWithSpviewerOnlyKeys}`,
    `Categories with changed values needing review: ${audit.counts.categoriesWithChangedValues}`,
    `Categories blocking retirement: ${audit.counts.categoriesBlockingRetirement}`,
    `Categories needing non-blocking review: ${audit.counts.categoriesNeedingReview}`,
    '',
    'Changed values are diagnostic only: DataCore is the current game-file authority, while SPViewer can be stale or miss patches.',
    '',
    '| Category | DataCore | SPViewer | Status | Blocking evidence | Review notes |',
    '| --- | --- | --- | --- | --- | --- |',
  ];

  for (const entry of audit.categories) {
    const comparison = entry.comparison;
    const evidence =
      entry.blockingReasons.length > 0
        ? entry.blockingReasons.join('; ')
        : `covered; ${comparison?.counts.datacoreKeys ?? 0} DataCore keys, ${comparison?.counts.spviewerKeys ?? 0} SPViewer keys`;
    const review = entry.reviewNotes.length > 0 ? entry.reviewNotes.join('; ') : 'none';
    lines.push(
      `| ${entry.category} | ${entry.datacoreSlug ?? 'missing'} | ${entry.spviewerSlug} | ${entry.status} | ${evidence} | ${review} |`,
    );
    if (comparison && (entry.blockingReasons.length > 0 || entry.reviewNotes.length > 0)) {
      const crossCategory =
        entry.crossCategoryDatacoreKeys && entry.crossCategoryDatacoreKeys.length > 0
          ? `; cross-category DataCore coverage=${entry.crossCategoryDatacoreKeys
              .slice(0, maxKeys)
              .map((item) => `${item.key} via ${item.datacoreSlug}`)
              .join(', ')}${
              entry.crossCategoryDatacoreKeys.length > maxKeys
                ? `, ...and ${entry.crossCategoryDatacoreKeys.length - maxKeys} more`
                : ''
            }`
          : '';
      const nonBlocking =
        entry.nonBlockingSpviewerOnlyKeys && entry.nonBlockingSpviewerOnlyKeys.length > 0
          ? `; classified non-blocking=${entry.nonBlockingSpviewerOnlyKeys
              .slice(0, maxKeys)
              .map((item) => item.key)
              .join(', ')}${
              entry.nonBlockingSpviewerOnlyKeys.length > maxKeys
                ? `, ...and ${entry.nonBlockingSpviewerOnlyKeys.length - maxKeys} more`
                : ''
            }`
          : '';
      lines.push(
        `  Samples: changed=${sampleKeys(comparison.changedValues, maxKeys)}; spviewer-only=${sampleKeys(
          comparison.spviewerOnly,
          maxKeys,
        )}${crossCategory}${nonBlocking}`,
      );
    }
    if (entry.error) {
      lines.push(`  Error: ${entry.error}`);
    }
  }

  return lines.join('\n');
}
