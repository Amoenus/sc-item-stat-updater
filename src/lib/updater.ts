import fs from 'node:fs/promises';
import path from 'node:path';
import { readCsvFile } from '../io/local/csv-parser';
import { findIniKey, readIniFile, writeIniFile } from '../io/local/ini-file';
import { readJsonFile } from '../io/local/json-file';
import { buildLookupMap, loadMappingFile, saveMappingFile } from '../io/local/mapping-store';
import { resolveChildPath } from '../io/local/path-conventions';
import { applyPatchPlanToIniLines } from '../localization/patch-application';
import type { PatchPlan } from '../pipeline/types';
import { sanitizeIniValue } from './format/formatter';
import { nameKeyToDescKey as defaultNameKeyToDescKey, extractFlavorText } from './format/text-utils';
import { buildReverseNameIndex, resolveLocalizationKeys } from './key-resolver';
import { getLogger } from './logger';
import type { IssueRecord, ItemConfig } from './types';

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

export interface IniPlanningContext {
  lines: string[];
  existingKeys: Record<string, number>;
  lowerCaseIndex: Map<string, string>;
  allOccurrences: Map<string, number[]>;
}

interface UpdateStats {
  updatedCount: number;
  newCount: number;
  skippedCount: number;
  foundCount: number;
  errorCount: number;
  unresolvedCount: number;
  issues: IssueRecord[];
}

export interface UpdatePlanResult extends UpdateStats {
  label: string;
  plan: PatchPlan;
  newLines: string[];
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
  const columns = new Set(Object.keys(rows[0]));
  const missing = requiredColumns.filter((col: string) => !columns.has(col));
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
): Promise<{ resolvedRows: Record<string, string>[]; unresolved: string[] }> {
  const reverseIndex = buildReverseNameIndex(lines);
  const lookupMap = config.lookupCsvFile ? await loadLookupMap(config.lookupCsvFile, csvDir) : null;
  const mappingsDir = path.resolve(baseDir, 'mappings');
  const mappingBasename = path.basename(config.csvFile ?? 'unknown.csv').replace(/\.csv$/i, '.json');
  const mappingFile = path.join(mappingsDir, mappingBasename);
  const savedMapping = await loadMappingFile(mappingFile);
  const nameColumn = config.nameColumn;
  if (!nameColumn) throw new Error(`resolveSpviewerKeys requires nameColumn on config "${config.label}"`);
  const { resolved, unresolved, mapping } = resolveLocalizationKeys(
    rows,
    nameColumn,
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
      resolved: resolved.length,
      unresolved: unresolved.length,
    });
  }
  return { resolvedRows: resolved, unresolved };
}

async function loadLookupMap(lookupCsvFile: string, csvDir: string): Promise<Map<string, string>> {
  const lookupPath = resolveChildPath(csvDir, lookupCsvFile, 'lookup CSV filename');
  return buildLookupMap(lookupPath);
}

/** Finds the last existing description key index for insertion ordering. */
function findLastDescIndex(
  existingKeys: Record<string, number>,
  lowerCaseIndex: Map<string, string>,
  descKeyMatch: (key: string) => boolean,
): number {
  let lastDescIdx = -1;
  for (const [lowerKey, key] of lowerCaseIndex.entries()) {
    const idx = existingKeys[key];
    if (descKeyMatch(lowerKey) && idx > lastDescIdx) {
      lastDescIdx = idx;
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

type KeyUpdateResult = 'notFound' | 'found' | 'updated';

/**
 * Attempts to plan updates for all occurrences of a target key (base form,
 * plural/gendered variants, and true duplicates). Each occurrence is planned
 * independently using its own existing value, so variant strings with different
 * surrounding text are handled correctly.
 */
function tryPlanKey(targetKey: string, context: PlanningContext, row: Record<string, string>): KeyUpdateResult {
  const foundKey = findIniKey(context.existingKeys, context.lowerCaseIndex, targetKey);
  if (!foundKey) return 'notFound';

  const lineIndices = context.allOccurrences.get(foundKey) ?? [context.existingKeys[foundKey]];
  let anyUpdated = false;

  for (const lineIndex of lineIndices) {
    const oldLine = context.lines[lineIndex];
    const eqIdx = oldLine.indexOf('=');
    const oldValue = eqIdx > -1 ? oldLine.substring(eqIdx + 1) : '';
    const buildValue = context.config.buildValue;
    if (!buildValue) throw new Error(`buildValue is required for config "${context.config.label}"`);
    const newValue = sanitizeIniValue(buildValue(row, extractFlavorText(oldValue), oldValue, foundKey));
    if (newValue !== oldValue) {
      context.planPatch(foundKey, newValue, lineIndex);
      anyUpdated = true;
    }
  }

  return anyUpdated ? 'updated' : 'found';
}

function planRow(
  row: Record<string, string>,
  context: PlanningContext,
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
    const result = tryPlanKey(targetKey, context, row);
    if (result !== 'notFound') {
      anyFound = true;
      if (result === 'updated') anyUpdated = true;
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

/**
 * Preflight check: verifies that every static CSV / JSON source file declared
 * in a config actually exists on disk before any update logic runs.
 *
 * Configs that use `resolveJsonFile` are intentionally skipped — they locate
 * their source dynamically (e.g. globbing for the latest merged-*.json) and
 * already emit clear "not found" errors at read time.
 *
 * All missing paths are collected before throwing so users see every problem
 * at once rather than discovering them one run at a time.
 */
export async function preflightCheckConfigs(categories: Array<{ config: ItemConfig; csvDir: string }>): Promise<void> {
  const perConfig = await Promise.all(
    categories.map(async ({ config, csvDir }) => {
      // Skip configs whose file is resolved dynamically at runtime.
      if (config.resolveJsonFile) return [];
      const filenames = [config.csvFile, config.jsonFile, config.lookupCsvFile].filter(
        (f): f is string => typeof f === 'string',
      );
      const missingResults = await Promise.all(
        filenames.map(async (filename) => {
          const filePath = resolveChildPath(csvDir, filename, 'source file');
          try {
            await fs.access(filePath);
            return null;
          } catch {
            return `  [${config.label}] ${filename}`;
          }
        }),
      );
      return missingResults.filter((m): m is string => m !== null);
    }),
  );

  const missing = perConfig.flat();
  if (missing.length > 0) {
    throw new Error(
      `Preflight check failed — ${missing.length} source file(s) not found:\n${missing.join('\n')}\n\nRun the scrapers first to populate the missing files.`,
    );
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

class PlanningContext {
  config: ItemConfig;
  lines: string[];
  existingKeys: Record<string, number>;
  lowerCaseIndex: Map<string, string>;
  allOccurrences: Map<string, number[]>;
  updatedKeys: Set<string>;
  plan: PatchPlan;
  newLines: string[];
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
    lowerCaseIndex: Map<string, string>,
    allOccurrences: Map<string, number[]>,
    unresolvedNames: string[],
  ) {
    this.config = config;
    this.lines = lines;
    this.existingKeys = existingKeys;
    this.lowerCaseIndex = lowerCaseIndex;
    this.allOccurrences = allOccurrences;

    this.updatedKeys = new Set();
    this.plan = { entries: [], issues: [] };
    this.newLines = [];
    this.issues = unresolvedNames.map((name) => ({
      label: config.label,
      key: name,
      reason: 'No localization key found',
      type: 'unresolved',
    }));
    this.plan.issues = this.issues;

    this.updatedCount = 0;
    this.newCount = 0;
    this.foundCount = 0;
    this.skippedCount = 0;
    this.errorCount = 0;
    this.unresolvedCount = unresolvedNames.length;
  }

  planPatch(key: string, value: string, existingLineIndex: number): void {
    this.plan.entries.push({
      key,
      value,
      source: this.config.label,
      reason: 'Existing updater patch',
      existingLineIndex,
    });
  }

  markSkipped() {
    this.skippedCount++;
  }

  markInvalid(key: string, reason = 'Invalid localization key'): void {
    this.issues.push({ label: this.config.label, key, reason, type: 'error' });
    this.errorCount++;
  }

  markError(key: string, error: Error): void {
    logger.debug('Failed to process row, skipping', { label: this.config.label, key, error: error.message });
    this.issues.push({ label: this.config.label, key, reason: `Build failed: ${error.message}`, type: 'error' });
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
    logger.debug('Missing key in target INI file, skipping', { label: this.config.label, key });
    this.issues.push({ label: this.config.label, key, reason: 'Key missing from global.ini', type: 'missing' });
    this.skippedCount++;
  }

  buildPlan(): UpdatePlanResult {
    return {
      label: this.config.label,
      plan: this.plan,
      newLines: this.newLines,
      updatedCount: this.updatedCount,
      newCount: this.newCount,
      skippedCount: this.skippedCount,
      foundCount: this.foundCount,
      errorCount: this.errorCount,
      unresolvedCount: this.unresolvedCount,
      issues: this.issues,
    };
  }
}

function buildUpdateResult(planResult: UpdatePlanResult, patches: Record<string, string>, dryRun: boolean, durationMs: number) {
  const suffix = dryRun ? ' (dry run)' : '';
  const errorSuffix = planResult.errorCount > 0 ? `, Errors ${planResult.errorCount}` : '';
  const unresolvedSuffix = planResult.unresolvedCount > 0 ? `, Unresolved ${planResult.unresolvedCount}` : '';
  const foundSuffix = planResult.foundCount > 0 ? `, Found ${planResult.foundCount}` : '';
  const summary = `${planResult.label}: Updated ${planResult.updatedCount}, Added ${planResult.newCount}${foundSuffix}, Skipped ${planResult.skippedCount}${errorSuffix}${unresolvedSuffix}${suffix} [${durationMs}ms]`;

  const stats = {
    updatedCount: planResult.updatedCount,
    newCount: planResult.newCount,
    skippedCount: planResult.skippedCount,
    foundCount: planResult.foundCount,
    errorCount: planResult.errorCount,
    unresolvedCount: planResult.unresolvedCount,
    issues: planResult.issues,
  };

  logger.debug(summary, {
    label: planResult.label,
    durationMs,
    dryRun,
    ...stats,
    issues: planResult.issues.length,
  });

  return {
    label: planResult.label,
    ...stats,
    patches,
    newLines: planResult.newLines,
    plan: planResult.plan,
    summary,
  };
}

export function buildUpdatePlan(
  config: ItemConfig,
  rows: Record<string, string>[],
  iniContext: IniPlanningContext,
  unresolvedNames: string[] = [],
  force = false,
): UpdatePlanResult {
  const deriveDescKey = config.nameKeyToDescKey || defaultNameKeyToDescKey;
  const context = new PlanningContext(
    config,
    iniContext.lines,
    iniContext.existingKeys,
    iniContext.lowerCaseIndex,
    iniContext.allOccurrences,
    unresolvedNames,
  );

  for (const row of rows) {
    const validation = getRowValidation(config, row);
    if (validation === 'skip') {
      context.markSkipped();
      continue;
    }
    if (validation === 'invalid') {
      context.markInvalid(row['Localization Key']);
      continue;
    }

    try {
      planRow(row, context, deriveDescKey, force);
    } catch (err) {
      context.markError(row['Localization Key'], err instanceof Error ? err : new Error(String(err)));
    }
  }

  return context.buildPlan();
}

/**
 * Returns true when the INI file should be written to disk.
 * - Never writes during a dry run.
 * - Always writes when `force` is set (even if no values changed).
 * - Otherwise writes only when at least one line was updated or added.
 */
function shouldWriteIni(opts: ResolvedOptions, planResult: UpdatePlanResult): boolean {
  if (opts.dryRun) return false;
  if (opts.force) return true;
  return planResult.updatedCount > 0 || planResult.newCount > 0;
}

/** Determines the validation result for a row, bypassing column validation for configs with custom target key logic. */
function getRowValidation(config: ItemConfig, row: Record<string, string>): 'valid' | 'skip' | 'invalid' {
  if (config.getTargetKeys && !row['Localization Key']) return 'valid';
  return validateRow(row, config.label);
}

/** Runs a source-based update against global.ini. */
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
    const { lines, index: existingKeys, lowerCaseIndex, allOccurrences } = await readIniFile(opts.iniPath);
    const originalLineCount = lines.length;

    let resolvedRows = rows;
    let unresolvedNames: string[] = [];
    if (config.nameColumn) {
      const result = await resolveSpviewerKeys(rows, config, lines, opts.csvDir, opts.baseDir, opts.dryRun);
      resolvedRows = result.resolvedRows;
      unresolvedNames = result.unresolved;
    }

    const lastDescIdx = findLastDescIndex(existingKeys, lowerCaseIndex, config.descKeyMatch);

    const planResult = buildUpdatePlan(
      config,
      resolvedRows,
      { lines, existingKeys, lowerCaseIndex, allOccurrences },
      unresolvedNames,
      opts.force,
    );
    const application = applyPatchPlanToIniLines(lines, existingKeys, planResult.plan, { insertionIndex: lastDescIdx });

    validateIntegrity(originalLineCount, application.lines);

    if (shouldWriteIni(opts, planResult)) {
      await writeIniFile(opts.iniPath, application.lines, { skipBackup: opts.skipBackup });
    }

    const durationMs = Math.round(performance.now() - start);
    return buildUpdateResult(planResult, application.patches, opts.dryRun, durationMs);
  } catch (err) {
    throw new Error(`Failed to update ${config.label}: ${(err as Error).message}`, { cause: err });
  }
}

/**
 * Runs the Extract+Transform phase for one item config and returns a patch manifest
 * (key→value pairs) without writing to global.ini. This is the per-category primitive
 * used by the artifact generator (ADR 002).
 */
export async function buildPatchData(config: ItemConfig, options: UpdateOptions = {}) {
  const result = await runUpdate(config, { ...options, dryRun: true, skipBackup: true });
  const { patches, newLines, issues, summary, label, plan, ...stats } = result;
  return { label, patches, newLines, issues, stats, plan, summary };
}
