import fs from 'node:fs/promises';
import path from 'node:path';
import type { ItemConfig } from '../../enrichment/item-config';
import { readCsvFile } from '../../io/local/csv-parser';
import { listMatchingFiles } from '../../io/local/discovery';
import { resolveChildPath } from '../../io/local/path-conventions';
import { loadDatacoreConfigs } from '../../items/registry';
import { createDataCoreRecordGraphLookup } from '../../sources/datacore/record-graph-loader';
import { createDataCoreRelationshipIndex } from '../../sources/datacore/relationship-index';
import type { DataCoreRecordGraph } from '../../sources/datacore/types';
import { resolveLatestVersionDir } from '../use-cases/prepare-update-categories';

export interface DataCorePatchDriftComponentFileDiagnostic {
  csvFile: string;
  rows: number;
  ownedBy: string[];
  status: 'owned' | 'unowned-component-shaped';
  missingGraphRecords: number;
  rowsWithLocalizationKeys: number;
}

export interface DataCorePatchDriftRelationshipMetric {
  name: string;
  current: number;
  previous?: number;
  delta?: number;
  percentChange?: number;
  status: 'ok' | 'changed' | 'new' | 'removed' | 'no-baseline';
}

export interface DataCorePatchDriftDiagnostics {
  versionDir: string;
  previousVersionDir?: string;
  graphStatus: 'present' | 'missing';
  warnings: string[];
  componentFiles: DataCorePatchDriftComponentFileDiagnostic[];
  relationshipMetrics: DataCorePatchDriftRelationshipMetric[];
}

export interface BuildDataCorePatchDriftDiagnosticsOptions {
  repoRoot?: string;
  datacoreVersionDir?: string;
  previousDatacoreVersionDir?: string;
  ptu?: boolean;
  ownedDataCoreFiles?: Map<string, string[]> | Record<string, string[]>;
  relationshipChangeThreshold?: number;
}

const COMPONENT_SHAPE_COLUMNS = [
  'Entity Class',
  'Name Key',
  'Description Key',
  'Manufacturer',
  'Size',
  'Grade',
  'Class',
];
const DEFAULT_RELATIONSHIP_CHANGE_THRESHOLD = 0.2;

export async function buildDataCorePatchDriftDiagnostics(
  options: BuildDataCorePatchDriftDiagnosticsOptions = {},
): Promise<DataCorePatchDriftDiagnostics> {
  const repoRoot = options.repoRoot ?? path.resolve(import.meta.dirname, '..', '..', '..');
  const versionDir =
    options.datacoreVersionDir ??
    (await resolveLatestVersionDir(path.join(repoRoot, 'csv', 'datacore'), options.ptu ?? false, 'DataCore', 'cache'));
  const previousVersionDir =
    options.previousDatacoreVersionDir ?? (await findPreviousDataCoreVersionDir(versionDir, options.ptu ?? false));
  const ownedFiles = options.ownedDataCoreFiles ?? (await collectOwnedDataCoreFiles());
  const graph = await readOptionalGraph(versionDir);
  const previousGraph = previousVersionDir ? await readOptionalGraph(previousVersionDir) : null;
  const relationshipIndex = graph ? createDataCoreRelationshipIndex(createDataCoreRecordGraphLookup(graph)) : null;
  const componentFiles = await collectComponentFileDiagnostics(versionDir, ownedFiles, relationshipIndex);
  const relationshipMetrics = collectRelationshipMetrics(
    graph,
    previousGraph,
    options.relationshipChangeThreshold ?? DEFAULT_RELATIONSHIP_CHANGE_THRESHOLD,
  );
  const warnings = collectWarnings({ graph, componentFiles, relationshipMetrics });

  return {
    versionDir,
    previousVersionDir: previousVersionDir ?? undefined,
    graphStatus: graph ? 'present' : 'missing',
    warnings,
    componentFiles,
    relationshipMetrics,
  };
}

async function collectOwnedDataCoreFiles(): Promise<Map<string, string[]>> {
  const configs = await loadDatacoreConfigs();
  const owned = new Map<string, string[]>();

  for (const [slug, config] of configs) {
    for (const file of declaredDataCoreFiles(config)) {
      const owners = owned.get(file) ?? [];
      if (!owners.includes(slug)) owners.push(slug);
      owned.set(file, owners);
    }
  }

  return owned;
}

function declaredDataCoreFiles(config: ItemConfig): string[] {
  const primary = [config.csvFile].filter((file): file is string => Boolean(file));
  const companions = (config.sourceFiles ?? [])
    .filter((sourceFile) => (sourceFile.sourceDir ?? 'csvDir') === 'csvDir' || sourceFile.sourceDir === 'datacore')
    .map((sourceFile) => sourceFile.file);
  return [...primary, ...companions].filter((file) => file.endsWith('.datacore.csv'));
}

async function collectComponentFileDiagnostics(
  versionDir: string,
  ownedFiles: BuildDataCorePatchDriftDiagnosticsOptions['ownedDataCoreFiles'],
  relationshipIndex: ReturnType<typeof createDataCoreRelationshipIndex> | null,
): Promise<DataCorePatchDriftComponentFileDiagnostic[]> {
  const ownerLookup = normalizeOwnedFiles(ownedFiles);
  const csvFiles = await listMatchingFiles(versionDir, (name) => name.endsWith('.datacore.csv'), {
    label: 'DataCore version directory',
  });
  const diagnostics = await Promise.all(
    csvFiles.map(async (csvFile) => {
      const rows = await readCsvFile(resolveChildPath(versionDir, csvFile, 'DataCore CSV filename'));
      if (!looksComponentShaped(rows)) return null;

      const ownedBy = ownerLookup.get(csvFile) ?? [];
      const rowsWithLocalizationKeys = relationshipIndex
        ? rows.filter(
            (row) => relationshipIndex.getLocalizationKeysForRecord(recordForRow(row, relationshipIndex)).length > 0,
          ).length
        : 0;
      const missingGraphRecords = relationshipIndex
        ? rows.filter((row) => row['Entity Class'] && !recordForRow(row, relationshipIndex)).length
        : rows.filter((row) => row['Entity Class']).length;
      return {
        csvFile,
        rows: rows.length,
        ownedBy,
        status: ownedBy.length > 0 ? 'owned' : 'unowned-component-shaped',
        missingGraphRecords,
        rowsWithLocalizationKeys,
      } satisfies DataCorePatchDriftComponentFileDiagnostic;
    }),
  );

  return diagnostics
    .filter((diagnostic): diagnostic is DataCorePatchDriftComponentFileDiagnostic => diagnostic !== null)
    .sort((a, b) => a.csvFile.localeCompare(b.csvFile));
}

function normalizeOwnedFiles(
  ownedFiles: BuildDataCorePatchDriftDiagnosticsOptions['ownedDataCoreFiles'],
): Map<string, string[]> {
  if (ownedFiles instanceof Map) return ownedFiles;
  return new Map(Object.entries(ownedFiles ?? {}));
}

function looksComponentShaped(rows: Record<string, string>[]): boolean {
  const firstRow = rows[0];
  if (!firstRow) return false;
  const columns = new Set(Object.keys(firstRow));
  return COMPONENT_SHAPE_COLUMNS.every((column) => columns.has(column));
}

function recordForRow(
  row: Record<string, string>,
  relationshipIndex: ReturnType<typeof createDataCoreRelationshipIndex>,
) {
  return relationshipIndex.getRecordForEntityClass(row['Entity Class']);
}

function collectRelationshipMetrics(
  graph: DataCoreRecordGraph | null,
  previousGraph: DataCoreRecordGraph | null,
  threshold: number,
): DataCorePatchDriftRelationshipMetric[] {
  if (!graph) return [];

  const current = summarizeGraphRelationships(graph);
  const previous = previousGraph ? summarizeGraphRelationships(previousGraph) : null;
  return [...current.entries()]
    .map(([name, currentValue]) => relationshipMetric(name, currentValue, previous?.get(name), threshold))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function relationshipMetric(
  name: string,
  current: number,
  previous: number | undefined,
  threshold: number,
): DataCorePatchDriftRelationshipMetric {
  if (previous === undefined) return { name, current, status: 'no-baseline' };
  if (previous === 0 && current > 0) return { name, current, previous, delta: current, status: 'new' };
  if (previous > 0 && current === 0)
    return { name, current, previous, delta: -previous, percentChange: -1, status: 'removed' };

  const delta = current - previous;
  const percentChange = previous === 0 ? 0 : delta / previous;
  return {
    name,
    current,
    previous,
    delta,
    percentChange,
    status: Math.abs(percentChange) >= threshold ? 'changed' : 'ok',
  };
}

function summarizeGraphRelationships(graph: DataCoreRecordGraph): Map<string, number> {
  return new Map([
    ['records.total', graph.recordCount],
    ['records.with-localization-keys', graph.records.filter((record) => record.localizationKeys.length > 0).length],
    ['relationships.localization-keys', graph.records.reduce((sum, record) => sum + record.localizationKeys.length, 0)],
    ['relationships.referenced-guids', graph.records.reduce((sum, record) => sum + record.referencedGuids.length, 0)],
    ['relationships.inbound-reference-targets', Object.keys(graph.indexes.byReferencedGuid).length],
  ]);
}

async function readOptionalGraph(versionDir: string): Promise<DataCoreRecordGraph | null> {
  try {
    const graphPath = resolveChildPath(versionDir, 'record-graph.json', 'DataCore record graph filename');
    return JSON.parse(await fs.readFile(graphPath, 'utf8')) as DataCoreRecordGraph;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

async function findPreviousDataCoreVersionDir(versionDir: string, ptu: boolean): Promise<string | null> {
  const parent = path.dirname(versionDir);
  const currentName = path.basename(versionDir);
  const channelPattern = ptu ? /\bptu\b|[-.]ptu\b/i : /\blive\b|[-.]live\b/i;
  const names = (await fs.readdir(parent, { withFileTypes: true }).catch(() => [] as import('node:fs').Dirent[]))
    .filter((entry) => entry.isDirectory() && entry.name !== currentName && channelPattern.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  const previous = names.filter((name) => name.localeCompare(currentName) < 0).at(-1) ?? names.at(-1);
  return previous ? path.join(parent, previous) : null;
}

function collectWarnings(options: {
  graph: DataCoreRecordGraph | null;
  componentFiles: DataCorePatchDriftComponentFileDiagnostic[];
  relationshipMetrics: DataCorePatchDriftRelationshipMetric[];
}): string[] {
  const warnings: string[] = [];
  if (!options.graph) warnings.push('record-graph.json is missing; DataCore relationship coverage cannot be checked.');
  for (const file of options.componentFiles) {
    if (file.status === 'unowned-component-shaped') {
      warnings.push(`${file.csvFile} looks component-shaped but is not declared by an active DataCore category.`);
    }
    if (file.missingGraphRecords > 0) {
      warnings.push(
        `${file.csvFile} has ${file.missingGraphRecords} rows without matching record-graph entity records.`,
      );
    }
  }
  for (const metric of options.relationshipMetrics) {
    if (metric.status === 'changed' || metric.status === 'removed') {
      warnings.push(`${metric.name} changed from ${metric.previous} to ${metric.current}.`);
    }
  }
  return warnings;
}

function formatPercent(value: number | undefined): string {
  if (value === undefined) return '';
  return `${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`;
}

export function formatDataCorePatchDriftDiagnostics(diagnostics: DataCorePatchDriftDiagnostics): string {
  const lines = [
    'DataCore patch drift audit',
    '',
    `Current DataCore: ${diagnostics.versionDir}`,
    `Previous DataCore: ${diagnostics.previousVersionDir ?? 'none'}`,
    `Record graph: ${diagnostics.graphStatus}`,
    '',
    '| CSV file | Status | Rows | Owners | Missing graph records | Rows with graph localization |',
    '| --- | --- | ---: | --- | ---: | ---: |',
  ];

  for (const file of diagnostics.componentFiles) {
    lines.push(
      `| ${file.csvFile} | ${file.status} | ${file.rows} | ${file.ownedBy.join(', ') || 'none'} | ${
        file.missingGraphRecords
      } | ${file.rowsWithLocalizationKeys} |`,
    );
  }

  lines.push('', '| Metric | Current | Previous | Change | Status |', '| --- | ---: | ---: | ---: | --- |');
  for (const metric of diagnostics.relationshipMetrics) {
    lines.push(
      `| ${metric.name} | ${metric.current} | ${metric.previous ?? ''} | ${formatPercent(metric.percentChange)} | ${
        metric.status
      } |`,
    );
  }

  if (diagnostics.warnings.length > 0) {
    lines.push('', 'Warnings:');
    for (const warning of diagnostics.warnings) lines.push(`  WARNING ${warning}`);
  }
  lines.push('', `Summary: ${diagnostics.warnings.length} patch drift warnings.`);
  return lines.join('\n');
}
