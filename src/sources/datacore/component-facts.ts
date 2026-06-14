import fs from 'node:fs/promises';
import { getLogger } from '../../infrastructure/logger';
import { readCsvFile } from '../../io/local/csv-parser';
import { resolveChildPath } from '../../io/local/path-conventions';
import {
  buildDataCoreHaulingComponentClassLookup,
  isDisplayDataCoreComponentClass,
  normalizeDataCoreEntityClass,
  normalizeSpaces,
} from './component-class-resolver';
import { createDataCoreManufacturerResolver, type DataCoreManufacturerResolver } from './manufacturer-resolver';
import { loadDataCoreRecordGraph } from './record-graph-loader';
import { graphLocalizationKeyFromReferences, uniqueGraphGuidReference } from './record-graph-relations';
import {
  createDataCoreRelationshipIndex,
  type DataCoreRelationshipIndex,
  normalizeDataCoreRelationshipLocalizationKey,
} from './relationship-index';
import type { DataCoreLocalizationReference, DataCoreRecordNode } from './types';

const logger = getLogger('datacore-component-facts');

const DEFAULT_COMPONENT_FACT_CSV_FILES = [
  'cooler.datacore.csv',
  'jumpdrive.datacore.csv',
  'miningmodifier.datacore.csv',
  'powerplant.datacore.csv',
  'quantumdrive.datacore.csv',
  'radar.datacore.csv',
  'shield.datacore.csv',
];
const NON_COMPONENT_FACT_CSV_FILES = new Set([
  'bomb.datacore.csv',
  'missile.datacore.csv',
  'missilelauncher.datacore.csv',
  'throwable.datacore.csv',
  'weaponattachment.datacore.csv',
  'weapondefensive.datacore.csv',
  'weaponmining.datacore.csv',
  'weaponpersonal.datacore.csv',
]);
const COMPONENT_FACT_REQUIRED_COLUMNS = ['Entity Class', 'Name Key', 'Manufacturer', 'Size', 'Grade', 'Class'];
type DataCoreRecordGraphLookup = Awaited<ReturnType<typeof loadDataCoreRecordGraph>>;

export type ComponentClassSource = 'datacore-attachdef' | 'datacore-hauling' | 'datacore-derived' | 'scmdb-bridge';
export type ComponentTitleKeySource = 'csv-name-key' | 'graph-localization' | 'guessed-alias';

export interface ComponentTitleKey {
  key: string;
  source: ComponentTitleKeySource;
}

export interface ComponentFact {
  source: 'datacore';
  entityClass: string;
  ref: string;
  recordPath: string;
  nameKey: string;
  descriptionKey: string;
  manufacturerCode: string;
  manufacturerName?: string;
  componentType: string;
  size: string;
  grade: string;
  componentClass?: string;
  componentClassSource?: ComponentClassSource;
  titleKeys: string[];
  titleKeySources: ComponentTitleKey[];
  stats: Record<string, string>;
}

interface LoadDataCoreComponentFactsOptions {
  datacoreDir: string;
  scmdbDir?: string;
}

interface ComponentFactRow {
  componentType: string;
  row: Record<string, string>;
  recordRef: string;
  recordPath: string;
  recordLocalizationKeys: DataCoreLocalizationReference[];
  recordManufacturerCode: string;
  scmdbClass?: string;
}

interface ResolvedClass {
  value: string;
  source: ComponentClassSource;
}

const FACT_COLUMNS = new Set([
  'Entity Class',
  'Name Key',
  'Short Name Key',
  'Description Key',
  'Manufacturer',
  'Size',
  'Grade',
  'Class',
]);
const PLACEHOLDER_LOCALIZATION_KEYS = new Set(['loc_empty', 'loc_placeholder', 'loc_uninitialized']);
const NON_USER_FACING_COMPONENT_PATTERNS = [
  /(?:^|[_/])(?:template|fake|prototype|test)(?:[_./]|$)/,
  /jumpdriveflighttuning|jumptunnelforces/,
  /(?:^|[_/])(?:unmanned_ai|antipersonnel_turret)(?:[_./]|$)/,
  /automatedturret/,
  /(?:^|[_/])camera(?:[_./]|$)|camera_mount|\/cameras\//,
  /resourcenetwork|(?:^|[_/])rn_/,
  /salvage_(?:buff_)?modifier_/,
];

export function isPlaceholderComponentLocalizationKey(value: unknown): boolean {
  const key = normalizeLocalizationKey(value);
  return key !== '' && PLACEHOLDER_LOCALIZATION_KEYS.has(key);
}

export function isLikelyNonUserFacingComponent(entityClass: string, recordPath: string): boolean {
  const value = `${entityClass} ${recordPath}`.toLowerCase();
  return NON_USER_FACING_COMPONENT_PATTERNS.some((pattern) => pattern.test(value));
}

export async function loadDataCoreComponentFacts({
  datacoreDir,
  scmdbDir,
}: LoadDataCoreComponentFactsOptions): Promise<ComponentFact[]> {
  const graph = await loadOptionalDataCoreRecordGraph(datacoreDir);
  const relationships = createDataCoreRelationshipIndex(graph);
  const manufacturerResolver = graph ? createDataCoreManufacturerResolver(graph) : undefined;
  const entityClassToHaulingClass = buildDataCoreHaulingComponentClassLookup(relationships);
  const scmdbClassByRef = scmdbDir ? await buildScmdbComponentClassLookup(scmdbDir) : new Map<string, string>();
  const rows: ComponentFactRow[] = [];

  for (const csvFile of await discoverComponentFactCsvFiles(datacoreDir)) {
    const filePath = resolveChildPath(datacoreDir, csvFile, 'DataCore component CSV filename');
    const csvRows = await readCsvFile(filePath);
    const componentType = componentTypeFromCsvFile(csvFile);

    for (const row of csvRows) {
      const record = getDataCoreRecordForRow(row, relationships);
      rows.push({
        componentType,
        row,
        recordRef: record?.ref ?? '',
        recordPath: record?.path ?? '',
        recordLocalizationKeys: record?.localizationKeys ?? [],
        recordManufacturerCode: getGraphComponentManufacturerCode(record, manufacturerResolver),
        scmdbClass: record?.ref ? scmdbClassByRef.get(record.ref.toLowerCase()) : undefined,
      });
    }
  }

  const manufacturerTypeToClass = buildManufacturerTypeClassLookup(rows, entityClassToHaulingClass);

  return rows.map((row) => toComponentFact(row, entityClassToHaulingClass, manufacturerTypeToClass));
}

export async function discoverComponentFactCsvFiles(datacoreDir: string): Promise<string[]> {
  const entries = await fs.readdir(datacoreDir, { withFileTypes: true });
  const discovered = new Set<string>();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.datacore.csv') || NON_COMPONENT_FACT_CSV_FILES.has(entry.name)) {
      continue;
    }

    const filePath = resolveChildPath(datacoreDir, entry.name, 'DataCore component CSV filename');
    const csvRows = await readCsvFile(filePath);
    const firstRow = csvRows[0];
    if (firstRow && COMPONENT_FACT_REQUIRED_COLUMNS.every((column) => column in firstRow)) {
      discovered.add(entry.name);
    }
  }

  for (const csvFile of DEFAULT_COMPONENT_FACT_CSV_FILES) {
    const filePath = resolveChildPath(datacoreDir, csvFile, 'DataCore component CSV filename');
    try {
      await fs.access(filePath);
      discovered.add(csvFile);
    } catch {
      logger.debug('Skipping missing DataCore component CSV', { csvFile, filePath });
    }
  }

  return [...discovered].sort();
}

async function loadOptionalDataCoreRecordGraph(datacoreDir: string): Promise<DataCoreRecordGraphLookup | null> {
  try {
    return await loadDataCoreRecordGraph({ versionDir: datacoreDir });
  } catch (err) {
    logger.debug('Skipping DataCore record graph lookup; record graph is missing or unreadable', {
      datacoreDir,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function buildScmdbComponentClassLookup(scmdbDir: string): Promise<Map<string, string>> {
  const classByRef = new Map<string, string>();
  const entries = await fs.readdir(scmdbDir, { withFileTypes: true });
  const craftingFile = entries
    .filter((entry) => entry.isFile() && /^crafting_items-.*\.json$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .at(-1);

  if (!craftingFile) {
    logger.debug('Skipping SCMDB component class lookup; crafting_items JSON is missing', { scmdbDir });
    return classByRef;
  }

  const filePath = resolveChildPath(scmdbDir, craftingFile, 'SCMDB crafting_items filename');
  const data = JSON.parse(await fs.readFile(filePath, 'utf8')) as {
    items?: Array<{ entityClass?: unknown; itemType?: unknown; componentClass?: unknown }>;
  };

  for (const item of data.items ?? []) {
    if (item.itemType !== 'shipcomponent') continue;
    const ref = normalizeSpaces(item.entityClass);
    const componentClass = normalizeSpaces(item.componentClass);
    if (ref && componentClass && isDisplayDataCoreComponentClass(componentClass)) {
      classByRef.set(ref.toLowerCase(), componentClass);
    }
  }

  return classByRef;
}

function getDataCoreRecordForRow(row: Record<string, string>, relationships: DataCoreRelationshipIndex) {
  const entityClass = normalizeDataCoreEntityClass(row['Entity Class']);
  if (!entityClass) return undefined;

  return relationships.getRecordForEntityClass(entityClass);
}

function buildManufacturerTypeClassLookup(
  rows: ComponentFactRow[],
  entityClassToHaulingClass: Map<string, string>,
): Map<string, string> {
  const candidates = new Map<string, Set<string>>();

  for (const item of rows) {
    const entityClass = normalizeDataCoreEntityClass(item.row['Entity Class']);
    const cls = entityClassToHaulingClass.get(entityClass);
    if (!cls) continue;

    const key = toManufacturerTypeKey(
      item.componentType,
      getComponentManufacturer(item.row, item.recordManufacturerCode),
    );
    if (!key) continue;
    const existing = candidates.get(key) ?? new Set<string>();
    existing.add(cls);
    candidates.set(key, existing);
  }

  const resolved = new Map<string, string>();
  for (const [key, values] of candidates) {
    if (values.size === 1) {
      resolved.set(key, [...values][0]);
    }
  }
  return resolved;
}

function toComponentFact(
  row: ComponentFactRow,
  entityClassToHaulingClass: Map<string, string>,
  manufacturerTypeToClass: Map<string, string>,
): ComponentFact {
  const resolvedClass = getComponentClass(row, entityClassToHaulingClass, manufacturerTypeToClass);
  const entityClass = normalizeDataCoreEntityClass(row.row['Entity Class']);
  const manufacturerCode = getComponentManufacturer(row.row, row.recordManufacturerCode);
  const titleKeySources = getComponentTitleKeySources(row.row, row.recordLocalizationKeys, row.recordPath);
  const graphDescriptionKey = getGraphDescriptionLocalizationKey(row.recordLocalizationKeys);
  const csvDescriptionKey = normalizeLocalizationKey(row.row['Description Key']);

  return {
    source: 'datacore',
    entityClass,
    ref: row.recordRef,
    recordPath: row.recordPath,
    nameKey: normalizeLocalizationKey(row.row['Name Key']),
    descriptionKey: graphDescriptionKey || (isUsableLocalizationKey(csvDescriptionKey) ? csvDescriptionKey : ''),
    manufacturerCode,
    componentType: row.componentType,
    size: normalizeSpaces(row.row.Size),
    grade: normalizeSpaces(row.row.Grade),
    componentClass: resolvedClass?.value,
    componentClassSource: resolvedClass?.source,
    titleKeys: uniqueKeys(titleKeySources.map(({ key }) => key)),
    titleKeySources,
    stats: getComponentStats(row.row),
  };
}

function getComponentClass(
  row: ComponentFactRow,
  entityClassToHaulingClass: Map<string, string>,
  manufacturerTypeToClass: Map<string, string>,
): ResolvedClass | undefined {
  const data = row.row;
  const cls = normalizeSpaces(data.Class);
  if (isDisplayDataCoreComponentClass(cls)) {
    return { value: cls, source: 'datacore-attachdef' };
  }

  const entityClass = normalizeDataCoreEntityClass(data['Entity Class']);
  const haulingClass = entityClassToHaulingClass.get(entityClass);
  if (haulingClass) {
    return { value: haulingClass, source: 'datacore-hauling' };
  }

  if (row.scmdbClass) {
    return { value: row.scmdbClass, source: 'scmdb-bridge' };
  }

  const derivedClass = manufacturerTypeToClass.get(
    toManufacturerTypeKey(row.componentType, getComponentManufacturer(row.row, row.recordManufacturerCode)),
  );
  if (derivedClass) {
    return { value: derivedClass, source: 'datacore-derived' };
  }

  return undefined;
}

function getComponentStats(row: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(row).filter(([key, value]) => !FACT_COLUMNS.has(key) && value !== ''));
}

function componentTypeFromCsvFile(csvFile: string): string {
  return csvFile.replace(/\.datacore\.csv$/i, '').toLowerCase();
}

function toManufacturerTypeKey(componentType: string, manufacturer: unknown): string {
  const normalizedManufacturer = normalizeSpaces(manufacturer).toUpperCase();
  return normalizedManufacturer ? `${componentType}:${normalizedManufacturer}` : '';
}

function getComponentManufacturer(row: Record<string, string>, graphManufacturerCode = ''): string {
  const graphManufacturer = normalizeSpaces(graphManufacturerCode);
  if (graphManufacturer) {
    return graphManufacturer;
  }

  const manufacturer = normalizeSpaces(row.Manufacturer);
  if (manufacturer) {
    return manufacturer;
  }

  const entityClass = normalizeDataCoreEntityClass(row['Entity Class']);
  const parts = entityClass.split('_');
  return parts.length >= 2 ? parts[1].toUpperCase() : '';
}

function getGraphComponentManufacturerCode(
  record: DataCoreRecordNode | undefined,
  manufacturerResolver: DataCoreManufacturerResolver | undefined,
): string {
  if (!record || !manufacturerResolver) return '';
  const manufacturerGuid = graphGuidReference(record, ['Manufacturer', 'manufacturer']);
  return manufacturerGuid ? (manufacturerResolver.getByRef(manufacturerGuid)?.code ?? '') : '';
}

function graphGuidReference(record: DataCoreRecordNode, attributes: string[]): string {
  return uniqueGraphGuidReference(record, attributes);
}

function getComponentTitleKeySources(
  row: Record<string, string>,
  recordLocalizationKeys: DataCoreLocalizationReference[],
  recordPath: string,
): ComponentTitleKey[] {
  const keys: ComponentTitleKey[] = [];
  const entityClass = normalizeDataCoreEntityClass(row['Entity Class']);
  for (const key of getGraphTitleLocalizationKeys(recordLocalizationKeys)) {
    for (const alias of getKnownTitleKeyAliases(key, entityClass)) {
      keys.push({ key: alias, source: 'graph-localization' });
    }
  }

  const nameKey = normalizeLocalizationKey(row['Name Key']);
  for (const key of getKnownTitleKeyAliases(nameKey, entityClass).filter(isUsableLocalizationKey)) {
    keys.push({ key, source: 'csv-name-key' });
  }

  const hasDataCoreTitleKey = keys.some(({ source }) => source === 'graph-localization' || source === 'csv-name-key');
  const hasAnyDataCoreTitleKey =
    hasGraphTitleLocalizationKey(recordLocalizationKeys) || normalizeLocalizationKey(row['Name Key']) !== '';
  if (
    entityClass &&
    !hasDataCoreTitleKey &&
    !hasAnyDataCoreTitleKey &&
    !isLikelyNonUserFacingComponent(entityClass, recordPath)
  ) {
    keys.push(
      { key: `item_name${entityClass}`, source: 'guessed-alias' },
      { key: `item_name_${entityClass}`, source: 'guessed-alias' },
      { key: `item_name${entityClass}_scitem`, source: 'guessed-alias' },
      { key: `item_name_${entityClass}_scitem`, source: 'guessed-alias' }
    );
  }

  return keys;
}

function hasGraphTitleLocalizationKey(recordLocalizationKeys: DataCoreLocalizationReference[]): boolean {
  return recordLocalizationKeys.some(
    ({ attribute, key }) => isGraphTitleAttribute(attribute) && normalizeLocalizationKey(key) !== '',
  );
}

function getGraphTitleLocalizationKeys(recordLocalizationKeys: DataCoreLocalizationReference[]): string[] {
  const keys: string[] = [];
  for (const attribute of ['Name', 'name', 'displayName']) {
    keys.push(
      ...recordLocalizationKeys
        .filter(({ attribute: candidate }) => candidate.trim().toLowerCase() === attribute.toLowerCase())
        .map(({ key }) => normalizeDataCoreRelationshipLocalizationKey(key))
        .filter(isUsableLocalizationKey),
    );
  }
  return uniqueKeys(keys);
}

function isGraphTitleAttribute(attribute: string): boolean {
  return ['name', 'displayname'].includes(attribute.trim().toLowerCase());
}

function getGraphDescriptionLocalizationKey(recordLocalizationKeys: DataCoreLocalizationReference[]): string {
  return normalizeDataCoreRelationshipLocalizationKey(
    graphLocalizationKeyFromReferences(recordLocalizationKeys, ['Description', 'description', 'displayDescription']),
  );
}

function isUsableLocalizationKey(key: string): boolean {
  return key !== '' && !isPlaceholderComponentLocalizationKey(key);
}

function getKnownTitleKeyAliases(key: string, entityClass: string): string[] {
  if (!key) return [];
  if (!entityClass || titleKeyEntityClass(key) !== entityClass) return [key];

  return [
    `item_name${entityClass}`,
    `item_name_${entityClass}`,
    `item_name${entityClass}_scitem`,
    `item_name_${entityClass}_scitem`,
  ];
}

function titleKeyEntityClass(key: string): string {
  return key
    .replace(/^item_name_?/i, '')
    .replace(/_scitem$/i, '')
    .toLowerCase();
}

function uniqueKeys(keys: string[]): string[] {
  return [...new Set(keys)];
}

function normalizeLocalizationKey(value: unknown): string {
  return normalizeSpaces(value).replace(/^@/, '').toLowerCase();
}
