import fs from 'node:fs/promises';
import path from 'node:path';
import { readCsvFile } from '../io/local/csv-parser.js';
import { findIniKey, readIniFile, writeIniFile } from '../io/local/ini-file.js';
import { readJsonFile } from '../io/local/json-file.js';
import { buildLookupMap, loadMappingFile, saveMappingFile } from '../io/local/mapping-store.js';
import { resolveChildPath } from '../io/local/path-conventions.js';
import { sanitizeIniValue } from './format/formatter.js';
import { nameKeyToDescKey as defaultNameKeyToDescKey, extractFlavorText } from './format/text-utils.js';
import { buildReverseNameIndex, resolveLocalizationKeys } from './key-resolver.js';
import { getLogger } from './logger.js';
import type { ItemConfig } from './types.js';

const logger = getLogger('updater');

/** Localization keys must contain only word chars, hyphens, and dots. */
const VALID_KEY_PATTERN = /^[\w\-.]+$/;

export function validateRow(row: Record<string, string>, label: string): 'skip' | 'invalid' | 'valid' {
  const nameKey = row['Localization Key'];
  if (!nameKey || nameKey === 'N/A') return 'skip';
  if (!VALID_KEY_PATTERN.test(nameKey)) {
    logger.debug('Invalid localization key, skipping row', { label, key: nameKey });
    return 'invalid';
  }
  return 'valid';
}

interface UpdateOptions {
  iniPath?: string;
  csvDir?: string;
  dryRun?: boolean;
  skipBackup?: boolean;
  force?: boolean;
}

interface ResolvedOptions {
  baseDir: string;
  iniPath: string;
  csvDir: string;
  dryRun: boolean;
  skipBackup: boolean;
  force: boolean;
}

/** Resolves base paths and option defaults. */
function resolveOptions(options: UpdateOptions): ResolvedOptions {
  const baseDir = path.resolve(import.meta.dirname, '..', '..');
  return {
    baseDir,
    iniPath: options.iniPath || path.join(baseDir, 'global.ini'),
    csvDir: options.csvDir || path.join(baseDir, 'csv'),
    dryRun: options.dryRun || false,
    skipBackup: options.skipBackup || false,
    force: options.force || false,
  };
}

function validateColumns(
  rows: Record<string, string>[],
  requiredColumns: string[] | undefined,
  sourceLabel: string,
): void {
  if (!requiredColumns || rows.length === 0) {
    return;
  }
  const columns = Object.keys(rows[0]);
  const missing = requiredColumns.filter((col: string) => !columns.includes(col));
  if (missing.length > 0) {
    throw new Error(`${sourceLabel} schema mismatch: missing columns: ${missing.join(', ')}`);
  }
}

async function loadJsonSourceData(config: ItemConfig, csvDir: string): Promise<Record<string, string>[]> {
  const rawJsonPath = config.resolveJsonFile
    ? await config.resolveJsonFile(csvDir)
    : resolveChildPath(csvDir, config.jsonFile ?? '', 'JSON filename');
  const normalizedJsonPath = path.isAbsolute(rawJsonPath) ? path.relative(csvDir, rawJsonPath) : rawJsonPath;
  const jsonPath = resolveChildPath(csvDir, normalizedJsonPath, 'JSON filename');
  logger.debug('Reading JSON file', { file: jsonPath, label: config.label });
  const data = await readJsonFile(jsonPath);
  const rows = config.parseJson ? config.parseJson(data) : [];
  if (!Array.isArray(rows)) {
    throw new TypeError(`JSON parser must return an array for ${config.label}`);
  }
  logger.debug('Parsed JSON rows', { count: rows.length, label: config.label });
  validateColumns(rows, config.requiredColumns, 'JSON');
  return rows;
}

async function loadCsvSourceData(config: ItemConfig, csvDir: string): Promise<Record<string, string>[]> {
  const csvPath = resolveChildPath(csvDir, config.csvFile ?? '', 'CSV filename');
  logger.debug('Reading CSV file', { file: csvPath, label: config.label });
  const rows = await readCsvFile(csvPath);
  logger.debug('Parsed CSV rows', { count: rows.length, label: config.label });
  validateColumns(rows, config.requiredColumns, 'CSV');
  return rows;
}

/** Reads and validates CSV or JSON data against the config's required columns. */
async function loadSourceData(config: ItemConfig, csvDir: string): Promise<Record<string, string>[]> {
  if (config.resolveJsonFile || config.jsonFile) {
    return loadJsonSourceData(config, csvDir);
  }
  return loadCsvSourceData(config, csvDir);
}

/** Resolves localization keys for SPViewer configs (no Localization Key column in CSV). */
async function resolveSpviewerKeys(
  rows: Record<string, string>[],
  config: ItemConfig,
  lines: string[],
  csvDir: string,
  baseDir: string,
  dryRun: boolean,
): Promise<string[]> {
  const reverseIndex = buildReverseNameIndex(lines);
  const lookupMap = config.lookupCsvFile ? await loadLookupMap(config.lookupCsvFile, csvDir) : null;
  const mappingsDir = path.resolve(baseDir, 'mappings');
  const mappingBasename = path.basename(config.csvFile ?? 'unknown.csv').replace(/\.csv$/i, '.json');
  const mappingFile = path.join(mappingsDir, mappingBasename);
  const savedMapping = await loadMappingFile(mappingFile);
  const { unresolved, mapping } = resolveLocalizationKeys(
    rows,
    config.nameColumn!,
    reverseIndex,
    lookupMap ?? undefined,
    savedMapping,
  );
  if (!dryRun) {
    await saveMappingFile(mappingFile, mapping);
  }
  if (unresolved.length > 0) {
    logger.debug('Key resolution summary', {
      label: config.label,
      resolved: rows.length,
      unresolved: unresolved.length,
    });
  }
  return unresolved;
}

async function loadLookupMap(lookupCsvFile: string, csvDir: string): Promise<Map<string, string>> {
  const lookupPath = resolveChildPath(csvDir, lookupCsvFile, 'lookup CSV filename');
  return buildLookupMap(lookupPath);
}

/** Finds the last existing description key index for insertion ordering. */
function findLastDescIndex(existingKeys: Record<string, number>, descKeyMatch: (key: string) => boolean): number {
  let lastDescIdx = -1;
  for (const [key, idx] of Object.entries(existingKeys)) {
    if (descKeyMatch(key.toLowerCase()) && (idx as number) > lastDescIdx) {
      lastDescIdx = idx as number;
    }
  }
  return lastDescIdx;
}

/** Processes a single row: updates existing key or queues a new entry. */
function getTargetKeys(
  config: ItemConfig,
  row: Record<string, string>,
  deriveDescKey: (nameKey: string) => string,
): string[] {
  if (config.getTargetKeys) {
    return config.getTargetKeys(row, deriveDescKey);
  }
  const nameKey = row['Localization Key'];
  const descKey = deriveDescKey(nameKey);
  const altKeys = config.getAlternateDescKeys ? config.getAlternateDescKeys(descKey) : [];
  return [descKey, ...altKeys];
}

function processRow(
  row: Record<string, string>,
  context: UpdateContext,
  deriveDescKey: (nameKey: string) => string,
  _force = false,
): void {
  const targetKeys = getTargetKeys(context.config, row, deriveDescKey);
  if (targetKeys.length === 0 || targetKeys.some((k) => context.updatedKeys.has(k.toLowerCase()))) {
    context.markSkipped();
    return;
  }

  let anyUpdated = false;
  let anyFound = false;

  for (const targetKey of targetKeys) {
    const foundKey = findIniKey(context.existingKeys, targetKey);
    if (foundKey) {
      anyFound = true;
      const lineIndex = context.existingKeys[foundKey];
      const oldLine = context.lines[lineIndex];
      const eqIdx = oldLine.indexOf('=');
      const oldValue = eqIdx > -1 ? oldLine.substring(eqIdx + 1) : '';
      const flavor = extractFlavorText(oldValue);
      const newValue = sanitizeIniValue(context.config.buildValue!(row, flavor, oldValue, foundKey));
      if (newValue !== oldValue) {
        context.lines[lineIndex] = `${foundKey}=${newValue}`;
        context.patches[foundKey] = newValue;
        anyUpdated = true;
      }
    }
  }
  if (anyFound) {
    for (const k of targetKeys) context.updatedKeys.add(k.toLowerCase());
    if (anyUpdated) {
      context.markUpdated();
    } else {
      context.markFound();
    }
    return;
  }

  context.markMissing(targetKeys[0] ?? '');
}


/** Inserts new lines at the correct position (after last matching desc key). */
function insertNewEntries(lines: string[], newLines: string[], lastDescIdx: number): void {
  if (newLines.length === 0) return;
  newLines.sort();
  if (lastDescIdx > -1) {
    for (let i = 0; i < newLines.length; i++) lines.splice(lastDescIdx + 1 + i, 0, newLines[i]);
  } else {
    lines.push(...newLines);
  }
}

export function validateIntegrity(originalLineCount: number, lines: string[]): void {
  if (originalLineCount - lines.length > 10) {
    throw new Error(
      `Integrity validation failed: File shrank excessively (original: ${originalLineCount}, new: ${lines.length})`,
    );
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && !line.startsWith(';') && !line.startsWith('[')) {
      if (!line.includes('=')) {
        throw new Error(
          `Integrity validation failed: Structural issue detected on line ${i + 1} (missing '=' delimiter)`,
        );
      }
    }
  }
}

type IssueRecord = { key: string; reason: string; type: string };

class UpdateContext {
  config: ItemConfig;
  lines: string[];
  existingKeys: Record<string, number>;
  dryRun: boolean;
  updatedKeys: Set<string>;
  newLines: string[];
  patches: Record<string, string>;
  issues: IssueRecord[];
  updatedCount: number;
  newCount: number;
  foundCount: number;
  skippedCount: number;
  errorCount: number;
  unresolvedCount: number;

  constructor(
    config: ItemConfig,
    lines: string[],
    existingKeys: Record<string, number>,
    unresolvedNames: string[],
    dryRun: boolean,
  ) {
    this.config = config;
    this.lines = lines;
    this.existingKeys = existingKeys;
    this.dryRun = dryRun;

    this.updatedKeys = new Set();
    this.newLines = [];
    this.patches = {};
    this.issues = unresolvedNames.map((name) => ({
      key: name,
      reason: 'No localization key found',
      type: 'unresolved',
    }));

    this.updatedCount = 0;
    this.newCount = 0;
    this.foundCount = 0;
    this.skippedCount = 0;
    this.errorCount = 0;
    this.unresolvedCount = unresolvedNames.length;
  }

  markSkipped() {
    this.skippedCount++;
  }

  markInvalid(key: string, reason = 'Invalid localization key'): void {
    this.issues.push({ key, reason, type: 'error' });
    this.errorCount++;
  }

  markError(key: string, error: Error): void {
    logger.debug('Failed to process row, skipping', { label: this.config.label, key, error: error.message });
    this.issues.push({ key, reason: `Build failed: ${error.message}`, type: 'error' });
    this.errorCount++;
  }

  markUpdated() {
    this.updatedCount++;
  }

  markNew(line: string): void {
    this.newLines.push(line);
    this.newCount++;
  }

  markFound() {
    this.foundCount++;
  }

  markMissing(key: string): void {
    logger.info('Missing key in target INI file, skipping', { label: this.config.label, key });
    this.issues.push({ key, reason: 'Key missing from global.ini', type: 'missing' });
    this.skippedCount++;
  }

  buildResult(durationMs: number) {
    const suffix = this.dryRun ? ' (dry run)' : '';
    const errorSuffix = this.errorCount > 0 ? `, Errors ${this.errorCount}` : '';
    const unresolvedSuffix = this.unresolvedCount > 0 ? `, Unresolved ${this.unresolvedCount}` : '';
    const foundSuffix = this.foundCount > 0 ? `, Found ${this.foundCount}` : '';
    const summary = `${this.config.label}: Updated ${this.updatedCount}, Added ${this.newCount}${foundSuffix}, Skipped ${this.skippedCount}${errorSuffix}${unresolvedSuffix}${suffix} [${durationMs}ms]`;

    const stats = {
      updatedCount: this.updatedCount,
      newCount: this.newCount,
      skippedCount: this.skippedCount,
      foundCount: this.foundCount,
      errorCount: this.errorCount,
      unresolvedCount: this.unresolvedCount,
      issues: this.issues,
    };

    logger.debug(summary, {
      label: this.config.label,
      durationMs,
      dryRun: this.dryRun,
      ...stats,
      issues: this.issues.length,
    });

    return { label: this.config.label, ...stats, patches: this.patches, newLines: this.newLines, summary };
  }
}

/**
 * Returns true when the INI file should be written to disk.
 * - Never writes during a dry run.
 * - Always writes when `force` is set (even if no values changed).
 * - Otherwise writes only when at least one line was updated or added.
 */
function shouldWriteIni(opts: ResolvedOptions, context: UpdateContext): boolean {
  if (opts.dryRun) return false;
  if (opts.force) return true;
  return context.updatedCount > 0 || context.newCount > 0;
}

/**
 * Runs a source-based update against global.ini.
 *
 * @param {import('./types.js').ItemConfig} config
 * @param {object} [options]
 * @param {string} [options.iniPath] - Path to global.ini (default: ./global.ini relative to project root)
 * @param {string} [options.csvDir] - Directory containing CSV and JSON files (default: ./csv)
 * @param {boolean} [options.dryRun] - Preview changes without writing (default: false)
 * @param {boolean} [options.skipBackup] - Skip backup rotation (default: false)
 * @param {boolean} [options.force] - Force writing the INI file when existing rows are found (default: false)
 */
export async function runUpdate(config: ItemConfig, options: UpdateOptions = {}) {
  const start = performance.now();
  const opts = resolveOptions(options);

  try {
    await fs.access(opts.iniPath);
  } catch {
    throw new Error(`INI file not found: ${opts.iniPath}`);
  }

  try {
    const rows = await loadSourceData(config, opts.csvDir);
    const { lines, index: existingKeys } = await readIniFile(opts.iniPath);
    const originalLineCount = lines.length;

    const unresolvedNames = config.nameColumn
      ? await resolveSpviewerKeys(rows, config, lines, opts.csvDir, opts.baseDir, opts.dryRun)
      : [];

    const deriveDescKey = config.nameKeyToDescKey || defaultNameKeyToDescKey;
    const lastDescIdx = findLastDescIndex(existingKeys, config.descKeyMatch);

    const context = new UpdateContext(config, lines, existingKeys, unresolvedNames, opts.dryRun);

    for (const row of rows) {
      const validation = config.getTargetKeys && !row['Localization Key'] ? 'valid' : validateRow(row, config.label);
      if (validation === 'skip') {
        context.markSkipped();
        continue;
      }
      if (validation === 'invalid') {
        context.markInvalid(row['Localization Key']);
        continue;
      }

      try {
        processRow(row, context, deriveDescKey, opts.force);
      } catch (err) {
        context.markError(row['Localization Key'], err instanceof Error ? err : new Error(String(err)));
      }
    }

    insertNewEntries(lines, context.newLines, lastDescIdx);

    validateIntegrity(originalLineCount, lines);

    if (shouldWriteIni(opts, context)) {
      await writeIniFile(opts.iniPath, lines, { skipBackup: opts.skipBackup });
    }

    const durationMs = Math.round(performance.now() - start);
    return context.buildResult(durationMs);
  } catch (err) {
    throw new Error(`Failed to update ${config.label}: ${(err as Error).message}`, { cause: err });
  }
}

/**
 * Runs the Extract+Transform phase for one item config and returns a patch manifest
 * (key→value pairs) without writing to global.ini. This is the per-category primitive
 * used by the artifact generator (ADR 002).
 *
 * @param {import('./types.js').ItemConfig} config
 * @param {object} [options]
 * @param {string} [options.iniPath]
 * @param {string} [options.csvDir]
 * @returns {Promise<{ label: string, patches: Record<string, string>, newLines: string[], issues: Array, stats: object }>}
 */
export async function buildPatchData(config: ItemConfig, options: UpdateOptions = {}) {
  const result = await runUpdate(config, { ...options, dryRun: true, skipBackup: true });
  const { patches, newLines, issues, summary, label, ...stats } = result;
  return { label, patches, newLines, issues, stats, summary };
}
