import fs from 'node:fs/promises';
import { getLogger } from '../../infrastructure/logger';
import { readCsvFile } from '../../io/local/csv-parser';
import { resolveChildPath } from '../../io/local/path-conventions';
import { readIniFile, writeIniFileIfChanged } from '../../localization/ini-file';
import { loadDataCoreRecordGraph } from '../../sources/datacore/record-graph-loader';
import {
  applyTagToFamily,
  buildVariantFamilyIndex,
  normalizeSpaces,
  parseNameLine,
  toVariantFamilyKey,
} from './title-tag-utils';
import { buildScannedUpdateResult } from './update-result';

const logger = getLogger('component-titles-update');

const COMPONENT_TITLE_CSV_FILES = [
  'cooler.datacore.csv',
  'jumpdrive.datacore.csv',
  'miningmodifier.datacore.csv',
  'powerplant.datacore.csv',
  'quantumdrive.datacore.csv',
  'radar.datacore.csv',
  'shield.datacore.csv',
];

const CLASS_ABBREV = {
  Stealth: 'Sth',
  Industrial: 'Ind',
  Civilian: 'Civ',
  Competition: 'Cmp',
  Commercial: 'Cmp',
  Military: 'Mil',
};

const NON_DISPLAY_CLASSES = new Set(['', 'BASIC', 'UNDEFINED', 'COOLER', 'POWER', 'QUANTUMDRIVE', 'RADAR', 'SHIELD']);
const HAULING_COMPONENT_CLASS_PATTERN =
  /^HaulingEntityClass_(?<type>Cooler|JumpDrive|PowerPlant|QuantumDrive|Radar|ShieldGenerator)_S\d+_(?<class>Civilian|Commercial|Competition|Industrial|Military|Stealth)$/i;

interface ComponentTitleRow {
  componentType: string;
  row: Record<string, string>;
}

function getComponentClass(
  row: ComponentTitleRow,
  entityClassToHaulingClass: Map<string, string>,
  manufacturerTypeToClass: Map<string, string>,
): string {
  const data = row.row;
  const cls = normalizeSpaces(data.Class);
  if (!NON_DISPLAY_CLASSES.has(cls.toUpperCase())) {
    return cls;
  }

  const entityClass = normalizeEntityClass(data['Entity Class']);
  return (
    entityClassToHaulingClass.get(entityClass) ??
    manufacturerTypeToClass.get(toManufacturerTypeKey(row.componentType, getComponentManufacturer(row.row))) ??
    ''
  );
}

function getDisplayGrade(grade: string): string {
  const clean = normalizeSpaces(grade).toUpperCase();
  if (/^[A-Z]$/.test(clean)) {
    return clean;
  }

  const numeric = Number(clean);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 26) {
    return String.fromCharCode('A'.charCodeAt(0) + numeric - 1);
  }

  return clean;
}

function getComponentPrefix(
  row: ComponentTitleRow,
  entityClassToHaulingClass: Map<string, string>,
  manufacturerTypeToClass: Map<string, string>,
): string | null {
  const cls = getComponentClass(row, entityClassToHaulingClass, manufacturerTypeToClass);
  const size = normalizeSpaces(row.row.Size);
  const grade = getDisplayGrade(row.row.Grade ?? '');
  if (!cls || !size || !grade) {
    return null;
  }
  const abbr = CLASS_ABBREV[cls as keyof typeof CLASS_ABBREV] || cls.slice(0, 3);
  return `${abbr}/${size}/${grade}`;
}

async function buildComponentTitleLookupFromDataCore(datacoreDir: string) {
  const keyToPrefix = new Map<string, { prefix: string }>();
  const entityClassToHaulingClass = await buildHaulingComponentClassLookup(datacoreDir);
  const rows: ComponentTitleRow[] = [];

  for (const csvFile of COMPONENT_TITLE_CSV_FILES) {
    const filePath = resolveChildPath(datacoreDir, csvFile, 'DataCore component CSV filename');
    try {
      await fs.access(filePath);
    } catch {
      logger.debug('Skipping missing DataCore component title CSV', { csvFile, filePath });
      continue;
    }
    const csvRows = await readCsvFile(filePath);
    const componentType = componentTypeFromCsvFile(csvFile);

    for (const row of csvRows) {
      rows.push({ componentType, row });
    }
  }

  const manufacturerTypeToClass = buildManufacturerTypeClassLookup(rows, entityClassToHaulingClass);

  for (const row of rows) {
    const prefix = getComponentPrefix(row, entityClassToHaulingClass, manufacturerTypeToClass);
    if (!prefix) continue;
    for (const key of getComponentTitleKeys(row.row)) {
      keyToPrefix.set(key, { prefix });
    }
  }

  return keyToPrefix;
}

async function buildHaulingComponentClassLookup(datacoreDir: string): Promise<Map<string, string>> {
  const entityClassToHaulingClass = new Map<string, string>();

  let graph: Awaited<ReturnType<typeof loadDataCoreRecordGraph>>;
  try {
    graph = await loadDataCoreRecordGraph({ versionDir: datacoreDir });
  } catch (err) {
    logger.debug('Skipping DataCore hauling component class lookup; record graph is missing or unreadable', {
      datacoreDir,
      error: err instanceof Error ? err.message : String(err),
    });
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

function buildManufacturerTypeClassLookup(
  rows: ComponentTitleRow[],
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

function normalizeLocalizationKey(value: unknown): string {
  return normalizeSpaces(value).replace(/^@/, '').toLowerCase();
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

function normalizeEntityClass(value: unknown): string {
  return normalizeSpaces(value).replace(/_SCItem$/i, '').toLowerCase();
}

function applyComponentTitlePrefixes(lines: string[], keyToPrefix: Map<string, { prefix: string }>) {
  const updatedLines = [...lines];
  const familyIndex = buildVariantFamilyIndex(updatedLines);
  const processedFamilies = new Set();

  let scannedCount = 0;
  let matchedCount = 0;
  let updatedCount = 0;

  for (const line of lines) {
    const parsed = parseNameLine(line);
    if (!parsed) {
      continue;
    }

    scannedCount++;
    const base = keyToPrefix.get(normalizeLocalizationKey(parsed.key));

    if (!base) {
      continue;
    }

    matchedCount++;
    const familyKey = toVariantFamilyKey(parsed.key);
    if (processedFamilies.has(familyKey)) {
      continue;
    }

    processedFamilies.add(familyKey);
    updatedCount += applyTagToFamily(
      updatedLines,
      familyIndex,
      familyKey,
      (cleanName: string) => `${base.prefix} ${cleanName}`,
    );
  }

  return { updatedLines, scannedCount, matchedCount, updatedCount };
}

/**
 * @param {object} params
 * @param {string} params.iniPath
 * @param {string} params.datacoreDir
 * @param {boolean} params.dryRun
 */
export async function runComponentTitleUpdate({
  iniPath,
  datacoreDir,
  dryRun,
}: {
  iniPath: string;
  datacoreDir: string;
  dryRun: boolean;
}) {
  const start = performance.now();
  const keyToPrefix = await buildComponentTitleLookupFromDataCore(datacoreDir);

  logger.info('Loaded component title lookup data', {
    csvFileCount: COMPONENT_TITLE_CSV_FILES.length,
    componentCount: keyToPrefix.size,
  });

  const iniData = await readIniFile(iniPath);
  const { lines } = iniData;
  const { updatedLines, scannedCount, matchedCount, updatedCount } = applyComponentTitlePrefixes(lines, keyToPrefix);

  await writeIniFileIfChanged(iniPath, updatedLines, { dryRun, updatedCount, skipBackup: true });

  const durationMs = Math.round(performance.now() - start);
  return buildScannedUpdateResult({
    label: 'Component Titles',
    updatedCount,
    matchedCount,
    scannedCount,
    dryRun,
    durationMs,
  });
}
