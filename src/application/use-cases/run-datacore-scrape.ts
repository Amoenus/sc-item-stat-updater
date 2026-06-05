import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { stringify } from 'csv-stringify/sync';
import {
  ensureToolsInstalled,
  readGameVersion,
  resolveLiveDir,
  runTool,
  type Unp4kTools,
} from '../../io/local/unp4k-tool';
import type { DataCoreFieldSelector, DataCoreItemTypeConfig } from '../../items/datacore/types';
import { extractDataCoreXmlCache } from '../../sources/datacore/acquisition';
import {
  type BuildDataCoreRecordGraphOptions,
  buildDataCoreRecordGraph,
  writeDataCoreRecordGraph,
} from '../../sources/datacore/record-graph';
import type { DataCoreRecordGraph } from '../../sources/datacore/types';
import {
  collectDataCoreXmlFilesMatching,
  countDataCoreXmlFiles,
  findDataCoreDcbFile,
} from '../../sources/datacore/xml-files';
import {
  extractAttachDef,
  extractEntityClass,
  extractHealth,
  loadXml,
  xmlVal,
} from '../../sources/datacore/xml-parser';

export interface DataCoreTypeEntry {
  name: string;
  csvFile: string;
  typeConfig: DataCoreItemTypeConfig;
}

export interface DataCoreScrapeTypeResult {
  type: string;
  rows: number;
  skipped: number;
  csvFile: string;
}

export interface DataCoreScrapeTypeError {
  type: string;
  message: string;
}

export interface RunDatacoreScrapeOptions {
  repoRoot: string;
  binDirname?: string;
  ptu?: boolean;
  dryRun?: boolean;
  forceExtract?: boolean;
  types?: string[];
  loadTypes?: (repoRoot: string) => Promise<DataCoreTypeEntry[]>;
  resolveLiveDir?: (binDirname: string) => string;
  readGameVersion?: (liveDir: string) => Promise<string>;
  findDcbFile?: (liveDir: string) => Promise<string>;
  ensureTools?: (toolDir: string, log: (message: string) => void) => Promise<Unp4kTools>;
  countXmlFiles?: (xmlCacheDir: string) => Promise<number>;
  extractXmlCache?: typeof extractDataCoreXmlCache;
  buildRecordGraph?: (options: BuildDataCoreRecordGraphOptions) => Promise<DataCoreRecordGraph>;
  writeRecordGraph?: (graph: DataCoreRecordGraph, outputPath: string) => Promise<void>;
  onPrepared?: (context: {
    gameVersion: string;
    channel: 'live' | 'ptu';
    dcbPath: string;
    outputBase: string;
    xmlCacheDir: string;
    selectedTypes: DataCoreTypeEntry[];
    allTypes: DataCoreTypeEntry[];
    dryRun: boolean;
  }) => void;
  onToolsLog?: (message: string) => void;
  onToolsReady?: (tools: Unp4kTools) => void;
  onTypeStart?: (entry: DataCoreTypeEntry, index: number) => void;
  onCacheHit?: (count: number, xmlCacheDir: string) => void;
  onCacheExtractStart?: (dcbPath: string, xmlCacheDir: string, clearExisting: boolean) => void;
  onCacheExtractComplete?: (count: number) => void;
  onRecordGraphBuilt?: (recordCount: number, outputPath: string, dryRun: boolean) => void;
}

export interface RunDatacoreScrapeResult {
  exitCode: number;
  gameVersion: string;
  channel: 'live' | 'ptu';
  versionTag: string;
  dcbPath: string;
  outputBase: string;
  xmlCacheDir: string;
  allTypes: DataCoreTypeEntry[];
  selectedTypes: DataCoreTypeEntry[];
  recordGraph: {
    recordCount: number;
    outputPath: string;
  };
  results: DataCoreScrapeTypeResult[];
  errors: DataCoreScrapeTypeError[];
}

const COMMON_HEADERS = ['Entity Class', 'Manufacturer', 'Size', 'Grade', 'Class', 'Health'];

export async function loadDataCoreTypeEntries(repoRoot: string): Promise<DataCoreTypeEntry[]> {
  const datacoreItemsDir = path.join(repoRoot, 'src', 'items', 'datacore');
  const entries = await fs.readdir(datacoreItemsDir);
  const result: DataCoreTypeEntry[] = [];

  for (const entry of entries) {
    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts') || entry === 'types.ts') continue;
    const slug = entry.replace(/\.ts$/, '');
    const fullPath = path.join(datacoreItemsDir, entry);
    const mod = await import(pathToFileURL(fullPath).href);
    if (!mod.DATACORE_TYPE_CONFIG) continue;
    const typeConfig: DataCoreItemTypeConfig = mod.DATACORE_TYPE_CONFIG;
    const csvFile: string = mod.default?.csvFile ?? `${slug}.datacore.csv`;
    result.push({ name: slug, csvFile, typeConfig });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export async function runDatacoreScrape(options: RunDatacoreScrapeOptions): Promise<RunDatacoreScrapeResult> {
  const loadTypes = options.loadTypes ?? loadDataCoreTypeEntries;
  const resolveLive = options.resolveLiveDir ?? resolveLiveDir;
  const readVersion = options.readGameVersion ?? readGameVersion;
  const findDcbFile = options.findDcbFile ?? findDataCoreDcbFile;
  const ensureTools = options.ensureTools ?? ensureToolsInstalled;
  const countXmlFiles = options.countXmlFiles ?? countDataCoreXmlFiles;
  const extractXmlCache = options.extractXmlCache ?? extractDataCoreXmlCache;
  const buildRecordGraph = options.buildRecordGraph ?? buildDataCoreRecordGraph;
  const writeRecordGraph = options.writeRecordGraph ?? writeDataCoreRecordGraph;
  const allTypes = await loadTypes(options.repoRoot);
  const selectedTypes = selectTypes(allTypes, options.types ?? []);
  const binDirname = options.binDirname ?? path.join(options.repoRoot, 'bin');
  const liveDir = resolveLive(binDirname);
  const gameVersion = await readVersion(liveDir);
  const channel = options.ptu ? 'ptu' : 'live';
  const versionTag = `${gameVersion}-${channel}`;
  const outputBase = path.join(options.repoRoot, 'csv', 'datacore', versionTag);
  const xmlCacheDir = path.join(options.repoRoot, 'csv', 'datacore', '.xmlcache', versionTag);
  const recordGraphPath = path.join(outputBase, 'record-graph.json');
  const dcbPath = await findDcbFile(liveDir);
  const toolDir = path.join(liveDir, 'unp4k');

  if (!options.dryRun) {
    await fs.mkdir(outputBase, { recursive: true });
  }

  options.onPrepared?.({
    gameVersion,
    channel,
    dcbPath,
    outputBase,
    xmlCacheDir,
    selectedTypes,
    allTypes,
    dryRun: Boolean(options.dryRun),
  });

  const tools = await ensureTools(toolDir, (message) => options.onToolsLog?.(message));
  options.onToolsReady?.(tools);
  const cachedCount = await countXmlFiles(xmlCacheDir);

  if (cachedCount > 0 && !options.forceExtract) {
    options.onCacheHit?.(cachedCount, xmlCacheDir);
  } else {
    const clearExisting = Boolean(options.forceExtract && cachedCount > 0);
    options.onCacheExtractStart?.(dcbPath, xmlCacheDir, clearExisting);
    const { xmlFileCount } = await extractXmlCache({
      dcbPath,
      xmlCacheDir,
      clearExisting,
      runUnforge: (cacheDir) => runTool(tools.unforge, [cacheDir]),
    });
    options.onCacheExtractComplete?.(xmlFileCount);
  }

  const recordGraph = await buildRecordGraph({ xmlCacheDir });
  if (!options.dryRun) {
    await writeRecordGraph(recordGraph, recordGraphPath);
  }
  options.onRecordGraphBuilt?.(recordGraph.recordCount, recordGraphPath, Boolean(options.dryRun));

  const results: DataCoreScrapeTypeResult[] = [];
  const errors: DataCoreScrapeTypeError[] = [];

  for (let index = 0; index < selectedTypes.length; index++) {
    const entry = selectedTypes[index];
    options.onTypeStart?.(entry, index);

    try {
      results.push(await scrapeDataCoreType(entry, { xmlCacheDir, outputBase, dryRun: options.dryRun }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ type: entry.name, message });
    }
  }

  return {
    exitCode: errors.length > 0 ? 1 : 0,
    gameVersion,
    channel,
    versionTag,
    dcbPath,
    outputBase,
    xmlCacheDir,
    allTypes,
    selectedTypes,
    recordGraph: {
      recordCount: recordGraph.recordCount,
      outputPath: recordGraphPath,
    },
    results,
    errors,
  };
}

function selectTypes(allTypes: DataCoreTypeEntry[], requestedNames: string[]): DataCoreTypeEntry[] {
  if (requestedNames.length === 0) return allTypes;

  return requestedNames.map((name) => {
    const found = allTypes.find((entry) => entry.name === name);
    if (!found) throw new Error(`Unknown item type: "${name}". Run with --list to see valid types.`);
    return found;
  });
}

async function scrapeDataCoreType(
  entry: DataCoreTypeEntry,
  options: { xmlCacheDir: string; outputBase: string; dryRun?: boolean },
): Promise<DataCoreScrapeTypeResult> {
  const { name, csvFile, typeConfig } = entry;
  const xmlFiles = await collectDataCoreXmlFilesMatching(options.xmlCacheDir, typeConfig.recordFilter);
  const typeHeaders = Object.keys(typeConfig.fieldSelectors);
  const headers = [...COMMON_HEADERS, ...typeHeaders];
  const rows: string[][] = [];
  let skipped = 0;

  for (const xmlPath of xmlFiles) {
    const xml = await fs.readFile(xmlPath, 'utf8');
    let $: ReturnType<typeof loadXml>;
    try {
      $ = loadXml(xml);
    } catch {
      skipped++;
      continue;
    }

    let entityClass = extractEntityClass($);
    if (!entityClass) {
      entityClass = path.basename(xmlPath, path.extname(xmlPath));
    }

    if (!entityClass || entityClass.startsWith('__')) {
      skipped++;
      continue;
    }

    const attachDef = extractAttachDef($);
    const health = extractHealth($);
    const rowRecord: Record<string, string> = {
      'Entity Class': entityClass,
      Manufacturer: attachDef.manufacturer,
      Size: attachDef.size,
      Grade: attachDef.grade,
      Class: attachDef.subtype,
      Health: health,
    };

    const typeFields = typeHeaders.map((col) => {
      const spec = typeConfig.fieldSelectors[col];
      if (!spec) {
        rowRecord[col] = '';
        return '';
      }
      const value = resolveField($, spec, rowRecord);
      rowRecord[col] = value;
      return value;
    });

    rows.push([
      entityClass,
      attachDef.manufacturer,
      attachDef.size,
      attachDef.grade,
      attachDef.subtype,
      health,
      ...typeFields,
    ]);
  }

  if (!options.dryRun && rows.length > 0) {
    const csvContent = stringify([headers, ...rows]);
    await fs.writeFile(path.join(options.outputBase, csvFile), csvContent, 'utf8');
  }

  return { type: name, rows: rows.length, skipped, csvFile };
}

function resolveField($: ReturnType<typeof loadXml>, spec: DataCoreFieldSelector, row: Record<string, string>): string {
  if (typeof spec === 'object' && 'derive' in spec) return spec.derive(row);
  if (typeof spec === 'string') return xmlVal($, spec);

  const element = spec.index === undefined ? $(spec.selector).first() : $(spec.selector).eq(spec.index);
  const values = spec.attrs?.map((attr) => element.attr(attr) ?? '') ?? [
    spec.attr ? (element.attr(spec.attr) ?? '') : '',
  ];

  if (spec.format === 'percent' && values[0]) return formatPercent(values[0]);
  if (spec.format === 'percent-pair') return values.map(formatPercent).join(spec.separator ?? ' / ');

  return values.join(spec.separator ?? ' / ');
}

function formatPercent(value: string): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return `${Number((num * 100).toFixed(2))}%`;
}
