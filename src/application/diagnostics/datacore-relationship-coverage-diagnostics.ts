import fs from 'node:fs/promises';
import path from 'node:path';
import { parseNameLine } from '../../enrichment/updates/title-tag-utils';
import {
  type ComponentFact,
  type ComponentTitleKeySource,
  isPlaceholderComponentLocalizationKey,
  loadDataCoreComponentFacts,
} from '../../sources/datacore/component-facts';
import { resolveLatestVersionDir } from '../use-cases/prepare-update-categories';

export interface DataCoreRelationshipCoverageDiagnostic {
  versionDir: string;
  iniPath?: string;
  totalComponents: number;
  duplicateComponentRowsIgnored: number;
  componentsWithGraphTitleKeys: number;
  componentsWithoutGraphTitleKeys: number;
  titleKeys: {
    total: number;
    graphLocalization: number;
    csvNameKey: number;
    guessedAlias: number;
    guessedOnly: number;
  };
  matchedIniKeys: {
    total: number;
    graphLocalization: number;
    csvNameKey: number;
    guessedAlias: number;
  };
  titleKeyGaps: DataCoreRelationshipCoverageTitleGapDiagnostic;
  componentFamilies: DataCoreRelationshipCoverageFamilyDiagnostic[];
  guessedOnlyMatches: DataCoreRelationshipCoverageGuessedMatch[];
  warnings: string[];
}

export interface DataCoreRelationshipCoverageFamilyDiagnostic {
  componentType: string;
  rows: number;
  rowsWithGraphTitleKeys: number;
  rowsWithoutGraphTitleKeys: number;
  status: 'covered' | 'partial' | 'no-graph-title-keys';
}

export interface DataCoreRelationshipCoverageGuessedMatch {
  key: string;
  entityClass: string;
  componentType: string;
}

export interface DataCoreRelationshipCoverageTitleGapDiagnostic {
  placeholderNameKey: number;
  missingNameKey: number;
  csvNameKeyOnly: number;
  other: number;
  samples: DataCoreRelationshipCoverageTitleGapSample[];
}

export interface DataCoreRelationshipCoverageTitleGapSample {
  entityClass: string;
  componentType: string;
  nameKey: string;
  reason: 'placeholder-name-key' | 'missing-name-key' | 'csv-name-key-only' | 'other';
}

export interface BuildDataCoreRelationshipCoverageDiagnosticsOptions {
  repoRoot?: string;
  datacoreVersionDir?: string;
  scmdbVersionDir?: string;
  iniPath?: string;
  ptu?: boolean;
  guessedOnlyMatchLimit?: number;
}

const DEFAULT_GUESSED_ONLY_MATCH_LIMIT = 25;
const SOURCE_PRIORITY: ComponentTitleKeySource[] = ['graph-localization', 'csv-name-key', 'guessed-alias'];

export async function buildDataCoreRelationshipCoverageDiagnostics(
  options: BuildDataCoreRelationshipCoverageDiagnosticsOptions = {},
): Promise<DataCoreRelationshipCoverageDiagnostic> {
  const repoRoot = options.repoRoot ?? path.resolve(import.meta.dirname, '..', '..', '..');
  const versionDir =
    options.datacoreVersionDir ??
    (await resolveLatestVersionDir(path.join(repoRoot, 'csv', 'datacore'), options.ptu ?? false, 'DataCore', 'cache'));
  const scmdbDir =
    options.scmdbVersionDir ??
    (await resolveOptionalLatestVersionDir(path.join(repoRoot, 'csv', 'scmdb'), options.ptu ?? false));
  const iniPath = options.iniPath ?? path.join(repoRoot, 'global.ini');
  const loadedFacts = await loadDataCoreComponentFacts({ datacoreDir: versionDir, scmdbDir });
  const { facts, duplicatesIgnored } = uniqueComponentFacts(loadedFacts);
  const iniKeys = await readOptionalIniNameKeys(iniPath);
  const keySources = buildKeySources(facts);
  const matchedIniKeys = countMatchedIniKeys(iniKeys, keySources);
  const guessedOnlyMatches = collectGuessedOnlyMatches(facts, iniKeys, keySources, options.guessedOnlyMatchLimit);
  const componentFamilies = summarizeComponentFamilies(facts);
  const titleKeyCounts = countTitleKeysBySource(keySources);
  const titleKeyGaps = summarizeTitleKeyGaps(facts);

  return {
    versionDir,
    iniPath: iniKeys ? iniPath : undefined,
    totalComponents: facts.length,
    duplicateComponentRowsIgnored: duplicatesIgnored,
    componentsWithGraphTitleKeys: facts.filter(hasGraphTitleKey).length,
    componentsWithoutGraphTitleKeys: facts.filter((fact) => !hasGraphTitleKey(fact)).length,
    titleKeys: titleKeyCounts,
    matchedIniKeys,
    titleKeyGaps,
    componentFamilies,
    guessedOnlyMatches,
    warnings: collectWarnings(componentFamilies, titleKeyCounts, matchedIniKeys, iniKeys),
  };
}

function uniqueComponentFacts(facts: ComponentFact[]): { facts: ComponentFact[]; duplicatesIgnored: number } {
  const seen = new Set<string>();
  const uniqueFacts: ComponentFact[] = [];

  for (const fact of facts) {
    const key = [fact.componentType, fact.entityClass, fact.recordPath || fact.ref].join('\0');
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueFacts.push(fact);
  }

  return { facts: uniqueFacts, duplicatesIgnored: facts.length - uniqueFacts.length };
}

async function resolveOptionalLatestVersionDir(base: string, ptu: boolean): Promise<string | undefined> {
  try {
    return await resolveLatestVersionDir(base, ptu, 'SCMDB', 'cache');
  } catch {
    return undefined;
  }
}

async function readOptionalIniNameKeys(iniPath: string): Promise<Set<string> | null> {
  try {
    const contents = await fs.readFile(iniPath, 'utf8');
    const keys = new Set<string>();
    for (const line of contents.split(/\r?\n/)) {
      const parsed = parseNameLine(line.replace(/^\ufeff/, ''));
      if (parsed) keys.add(normalizeKey(parsed.key));
    }
    return keys;
  } catch {
    return null;
  }
}

function buildKeySources(facts: ComponentFact[]): Map<string, Set<ComponentTitleKeySource>> {
  const sourcesByKey = new Map<string, Set<ComponentTitleKeySource>>();
  for (const fact of facts) {
    for (const { key, source } of fact.titleKeySources) {
      const normalizedKey = normalizeKey(key);
      if (!normalizedKey) continue;
      const sources = sourcesByKey.get(normalizedKey) ?? new Set<ComponentTitleKeySource>();
      sources.add(source);
      sourcesByKey.set(normalizedKey, sources);
    }
  }
  return sourcesByKey;
}

function countTitleKeysBySource(keySources: Map<string, Set<ComponentTitleKeySource>>) {
  let graphLocalization = 0;
  let csvNameKey = 0;
  let guessedAlias = 0;
  let guessedOnly = 0;

  for (const sources of keySources.values()) {
    if (sources.has('graph-localization')) graphLocalization++;
    if (sources.has('csv-name-key')) csvNameKey++;
    if (sources.has('guessed-alias')) guessedAlias++;
    if (sources.size === 1 && sources.has('guessed-alias')) guessedOnly++;
  }

  return {
    total: keySources.size,
    graphLocalization,
    csvNameKey,
    guessedAlias,
    guessedOnly,
  };
}

function countMatchedIniKeys(
  iniKeys: Set<string> | null,
  keySources: Map<string, Set<ComponentTitleKeySource>>,
): DataCoreRelationshipCoverageDiagnostic['matchedIniKeys'] {
  const counts = {
    total: 0,
    graphLocalization: 0,
    csvNameKey: 0,
    guessedAlias: 0,
  };
  if (!iniKeys) return counts;

  for (const key of iniKeys) {
    const sources = keySources.get(key);
    if (!sources) continue;
    counts.total++;
    const source = bestSource(sources);
    if (source === 'graph-localization') counts.graphLocalization++;
    if (source === 'csv-name-key') counts.csvNameKey++;
    if (source === 'guessed-alias') counts.guessedAlias++;
  }

  return counts;
}

function collectGuessedOnlyMatches(
  facts: ComponentFact[],
  iniKeys: Set<string> | null,
  keySources: Map<string, Set<ComponentTitleKeySource>>,
  limit = DEFAULT_GUESSED_ONLY_MATCH_LIMIT,
): DataCoreRelationshipCoverageGuessedMatch[] {
  if (!iniKeys) return [];

  const matches: DataCoreRelationshipCoverageGuessedMatch[] = [];
  const seen = new Set<string>();
  for (const fact of facts) {
    for (const { key } of fact.titleKeySources) {
      const normalizedKey = normalizeKey(key);
      const sources = keySources.get(normalizedKey);
      if (!iniKeys.has(normalizedKey) || !sources || sources.size !== 1 || !sources.has('guessed-alias')) continue;
      const seenKey = `${fact.componentType}|${fact.entityClass}|${normalizedKey}`;
      if (seen.has(seenKey)) continue;
      seen.add(seenKey);
      matches.push({ key: normalizedKey, entityClass: fact.entityClass, componentType: fact.componentType });
      if (matches.length >= limit) return matches;
    }
  }

  return matches;
}

function summarizeComponentFamilies(facts: ComponentFact[]): DataCoreRelationshipCoverageFamilyDiagnostic[] {
  const families = new Map<string, { rows: number; rowsWithGraphTitleKeys: number }>();
  for (const fact of facts) {
    const family = families.get(fact.componentType) ?? { rows: 0, rowsWithGraphTitleKeys: 0 };
    family.rows++;
    if (hasGraphTitleKey(fact)) family.rowsWithGraphTitleKeys++;
    families.set(fact.componentType, family);
  }

  return [...families.entries()]
    .map(([componentType, family]) => {
      const rowsWithoutGraphTitleKeys = family.rows - family.rowsWithGraphTitleKeys;
      return {
        componentType,
        rows: family.rows,
        rowsWithGraphTitleKeys: family.rowsWithGraphTitleKeys,
        rowsWithoutGraphTitleKeys,
        status:
          family.rowsWithGraphTitleKeys === 0
            ? 'no-graph-title-keys'
            : rowsWithoutGraphTitleKeys > 0
              ? 'partial'
              : 'covered',
      } satisfies DataCoreRelationshipCoverageFamilyDiagnostic;
    })
    .sort((a, b) => a.componentType.localeCompare(b.componentType));
}

function summarizeTitleKeyGaps(facts: ComponentFact[]): DataCoreRelationshipCoverageTitleGapDiagnostic {
  const gaps: DataCoreRelationshipCoverageTitleGapDiagnostic = {
    placeholderNameKey: 0,
    missingNameKey: 0,
    csvNameKeyOnly: 0,
    other: 0,
    samples: [],
  };

  for (const fact of facts) {
    if (hasGraphTitleKey(fact)) continue;

    const reason = titleGapReason(fact);
    if (reason === 'placeholder-name-key') gaps.placeholderNameKey++;
    if (reason === 'missing-name-key') gaps.missingNameKey++;
    if (reason === 'csv-name-key-only') gaps.csvNameKeyOnly++;
    if (reason === 'other') gaps.other++;

    if (gaps.samples.length < 12) {
      gaps.samples.push({
        entityClass: fact.entityClass,
        componentType: fact.componentType,
        nameKey: fact.nameKey,
        reason,
      });
    }
  }

  return gaps;
}

function titleGapReason(fact: ComponentFact): DataCoreRelationshipCoverageTitleGapSample['reason'] {
  if (fact.titleKeySources.some(({ source }) => source === 'csv-name-key')) return 'csv-name-key-only';
  if (isPlaceholderComponentLocalizationKey(fact.nameKey)) return 'placeholder-name-key';
  if (!fact.nameKey) return 'missing-name-key';
  return 'other';
}

function hasGraphTitleKey(fact: ComponentFact): boolean {
  return fact.titleKeySources.some(({ source }) => source === 'graph-localization');
}

function bestSource(sources: Set<ComponentTitleKeySource>): ComponentTitleKeySource {
  return SOURCE_PRIORITY.find((source) => sources.has(source)) ?? 'guessed-alias';
}

function collectWarnings(
  componentFamilies: DataCoreRelationshipCoverageFamilyDiagnostic[],
  titleKeys: DataCoreRelationshipCoverageDiagnostic['titleKeys'],
  matchedIniKeys: DataCoreRelationshipCoverageDiagnostic['matchedIniKeys'],
  iniKeys: Set<string> | null,
): string[] {
  const warnings: string[] = [];
  const uncoveredFamilies = componentFamilies.filter((family) => family.status === 'no-graph-title-keys');
  if (uncoveredFamilies.length > 0) {
    warnings.push(`${uncoveredFamilies.length} component families have no graph-derived title keys.`);
  }
  if (!iniKeys) {
    warnings.push('global.ini was not readable; matched localization key coverage was skipped.');
  } else if (matchedIniKeys.guessedAlias > 0) {
    warnings.push(`${matchedIniKeys.guessedAlias} matched INI component title keys rely on guessed aliases.`);
  }
  return warnings;
}

function normalizeKey(value: unknown): string {
  return String(value ?? '')
    .replace(/^@/, '')
    .trim()
    .toLowerCase();
}

export function formatDataCoreRelationshipCoverageDiagnostics(
  diagnostics: DataCoreRelationshipCoverageDiagnostic,
): string {
  const lines = [
    'DataCore relationship coverage audit',
    '',
    `DataCore version: ${path.basename(diagnostics.versionDir)} (${diagnostics.versionDir})`,
    `INI target: ${diagnostics.iniPath ?? 'not available'}`,
    '',
    `Components: ${diagnostics.totalComponents} unique; ${diagnostics.componentsWithGraphTitleKeys} with graph title keys; ${diagnostics.componentsWithoutGraphTitleKeys} without graph title keys; ${diagnostics.duplicateComponentRowsIgnored} duplicate rows ignored.`,
    `Title keys: ${diagnostics.titleKeys.total} total; ${diagnostics.titleKeys.graphLocalization} graph; ${diagnostics.titleKeys.csvNameKey} CSV name keys; ${diagnostics.titleKeys.guessedAlias} guessed aliases; ${diagnostics.titleKeys.guessedOnly} guessed-only.`,
    `Matched INI name keys: ${diagnostics.matchedIniKeys.total} total; ${diagnostics.matchedIniKeys.graphLocalization} graph; ${diagnostics.matchedIniKeys.csvNameKey} CSV name keys; ${diagnostics.matchedIniKeys.guessedAlias} guessed aliases.`,
    `Rows without graph title keys: ${diagnostics.titleKeyGaps.placeholderNameKey} placeholder name keys; ${diagnostics.titleKeyGaps.missingNameKey} missing name keys; ${diagnostics.titleKeyGaps.csvNameKeyOnly} CSV name-key only; ${diagnostics.titleKeyGaps.other} other.`,
    '',
    '| Component family | Status | Rows | Rows with graph title keys | Rows without graph title keys |',
    '| --- | --- | ---: | ---: | ---: |',
  ];

  for (const family of diagnostics.componentFamilies) {
    lines.push(
      `| ${family.componentType} | ${family.status} | ${family.rows} | ${family.rowsWithGraphTitleKeys} | ${family.rowsWithoutGraphTitleKeys} |`,
    );
  }

  lines.push('', 'Guessed-only INI matches:');
  if (diagnostics.guessedOnlyMatches.length === 0) {
    lines.push('  none');
  } else {
    for (const match of diagnostics.guessedOnlyMatches) {
      lines.push(`  ${match.key} (${match.componentType}, ${match.entityClass})`);
    }
  }

  lines.push('', 'Rows without graph title keys sample:');
  if (diagnostics.titleKeyGaps.samples.length === 0) {
    lines.push('  none');
  } else {
    for (const sample of diagnostics.titleKeyGaps.samples) {
      lines.push(`  ${sample.componentType}, ${sample.entityClass}: ${sample.reason} (${sample.nameKey || 'no name key'})`);
    }
  }

  lines.push('', `Summary: ${diagnostics.warnings.length} relationship coverage warnings.`);
  for (const warning of diagnostics.warnings) {
    lines.push(`  WARNING: ${warning}`);
  }

  return lines.join('\n');
}
