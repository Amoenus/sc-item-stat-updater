import fs from 'node:fs/promises';
import { getLogger } from '../../infrastructure/logger';
import { readCsvFile } from '../../io/local/csv-parser';
import { resolveChildPath } from '../../io/local/path-conventions';
import { loadDataCoreRecordGraph } from './record-graph-loader';

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
  'weapongun.datacore.csv',
  'weaponmining.datacore.csv',
  'weaponpersonal.datacore.csv',
]);
const COMPONENT_FACT_REQUIRED_COLUMNS = ['Entity Class', 'Name Key', 'Manufacturer', 'Size', 'Grade', 'Class'];
const NON_DISPLAY_CLASSES = new Set(['', 'BASIC', 'UNDEFINED', 'COOLER', 'POWER', 'QUANTUMDRIVE', 'RADAR', 'SHIELD']);
const HAULING_COMPONENT_CLASS_PATTERN =
  /^HaulingEntityClass_(?<type>Cooler|JumpDrive|PowerPlant|QuantumDrive|Radar|ShieldGenerator)_S\d+_(?<class>Civilian|Commercial|Competition|Industrial|Military|Stealth)$/i;

type DataCoreRecordGraphLookup = Awaited<ReturnType<typeof loadDataCoreRecordGraph>>;

export type ComponentClassSource = 'datacore-attachdef' | 'datacore-hauling' | 'datacore-derived' | 'scmdb-bridge';

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

export async function loadDataCoreComponentFacts({
  datacoreDir,
  scmdbDir,
}: LoadDataCoreComponentFactsOptions): Promise<ComponentFact[]> {
  const graph = await loadOptionalDataCoreRecordGraph(datacoreDir);
  const entityClassToHaulingClass = buildHaulingComponentClassLookup(graph);
  const scmdbClassByRef = scmdbDir ? await buildScmdbComponentClassLookup(scmdbDir) : new Map<string, string>();
  const rows: ComponentFactRow[] = [];

  for (const csvFile of await discoverComponentFactCsvFiles(datacoreDir)) {
    const filePath = resolveChildPath(datacoreDir, csvFile, 'DataCore component CSV filename');
    const csvRows = await readCsvFile(filePath);
    const componentType = componentTypeFromCsvFile(csvFile);

    for (const row of csvRows) {
      const record = getDataCoreRecordForRow(row, graph);
      rows.push({
        componentType,
        row,
        recordRef: record?.ref ?? '',
        recordPath: record?.path ?? '',
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

function buildHaulingComponentClassLookup(graph: DataCoreRecordGraphLookup | null): Map<string, string> {
  const entityClassToHaulingClass = new Map<string, string>();

  if (!graph) {
    return entityClassToHaulingClass;
  }

  for (const record of graph.getByRootType('Hauling_EntityClasses')) {
    const haulingClass = getHaulingComponentClass(record.entityClass);
    if (!haulingClass) continue;

    for (const ref of record.referencedGuids) {
      const componentRecord = graph.getByRef(ref);
      if (!componentRecord?.entityClass) continue;
      const entityClass = normalizeEntityClass(componentRecord.entityClass);
      if (entityClass) {
        entityClassToHaulingClass.set(entityClass, haulingClass);
      }
    }
  }

  return entityClassToHaulingClass;
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
    if (ref && componentClass && !NON_DISPLAY_CLASSES.has(componentClass.toUpperCase())) {
      classByRef.set(ref.toLowerCase(), componentClass);
    }
  }

  return classByRef;
}

function getDataCoreRecordForRow(row: Record<string, string>, graph: DataCoreRecordGraphLookup | null) {
  if (!graph) return undefined;

  const entityClass = normalizeEntityClass(row['Entity Class']);
  if (!entityClass) return undefined;

  return graph.graph.records.find((candidate) => normalizeEntityClass(candidate.entityClass) === entityClass);
}

function buildManufacturerTypeClassLookup(
  rows: ComponentFactRow[],
  entityClassToHaulingClass: Map<string, string>,
): Map<string, string> {
  const candidates = new Map<string, Set<string>>();

  for (const item of rows) {
    const entityClass = normalizeEntityClass(item.row['Entity Class']);
    const cls = entityClassToHaulingClass.get(entityClass);
    if (!cls) continue;

    const key = toManufacturerTypeKey(item.componentType, getComponentManufacturer(item.row));
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
  const entityClass = normalizeEntityClass(row.row['Entity Class']);
  const manufacturerCode = getComponentManufacturer(row.row);

  return {
    source: 'datacore',
    entityClass,
    ref: row.recordRef,
    recordPath: row.recordPath,
    nameKey: normalizeLocalizationKey(row.row['Name Key']),
    descriptionKey: normalizeLocalizationKey(row.row['Description Key']),
    manufacturerCode,
    componentType: row.componentType,
    size: normalizeSpaces(row.row.Size),
    grade: normalizeSpaces(row.row.Grade),
    componentClass: resolvedClass?.value,
    componentClassSource: resolvedClass?.source,
    titleKeys: getComponentTitleKeys(row.row),
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
  if (!NON_DISPLAY_CLASSES.has(cls.toUpperCase())) {
    return { value: cls, source: 'datacore-attachdef' };
  }

  const entityClass = normalizeEntityClass(data['Entity Class']);
  const haulingClass = entityClassToHaulingClass.get(entityClass);
  if (haulingClass) {
    return { value: haulingClass, source: 'datacore-hauling' };
  }

  if (row.scmdbClass) {
    return { value: row.scmdbClass, source: 'scmdb-bridge' };
  }

  const derivedClass = manufacturerTypeToClass.get(
    toManufacturerTypeKey(row.componentType, getComponentManufacturer(row.row)),
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

function getComponentManufacturer(row: Record<string, string>): string {
  const manufacturer = normalizeSpaces(row.Manufacturer);
  if (manufacturer) {
    return manufacturer;
  }

  const entityClass = normalizeEntityClass(row['Entity Class']);
  const parts = entityClass.split('_');
  return parts.length >= 2 ? parts[1].toUpperCase() : '';
}

function getHaulingComponentClass(entityClass: string): string {
  const match = HAULING_COMPONENT_CLASS_PATTERN.exec(entityClass);
  return match?.groups?.class ?? '';
}

function getComponentTitleKeys(row: Record<string, string>): string[] {
  const keys = new Set<string>();
  const nameKey = normalizeLocalizationKey(row['Name Key']);
  if (nameKey) keys.add(nameKey);

  const entityClass = normalizeEntityClass(row['Entity Class']);
  if (entityClass) {
    keys.add(`item_name${entityClass}`);
    keys.add(`item_name_${entityClass}`);
    keys.add(`item_name${entityClass}_scitem`);
    keys.add(`item_name_${entityClass}_scitem`);
  }

  return [...keys];
}

function normalizeLocalizationKey(value: unknown): string {
  return normalizeSpaces(value).replace(/^@/, '').toLowerCase();
}

function normalizeEntityClass(value: unknown): string {
  return normalizeSpaces(value)
    .replace(/_SCItem$/i, '')
    .toLowerCase();
}

function normalizeSpaces(value: unknown): string {
  let str: string;
  if (value == null) {
    str = '';
  } else if (typeof value === 'string') {
    str = value;
  } else {
    str = JSON.stringify(value);
  }
  return str
    .replaceAll(/[\u00a0\u202f]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}
