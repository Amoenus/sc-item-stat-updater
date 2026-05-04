import fs from 'node:fs/promises';
import path from 'node:path';
import { sanitizeIniValue } from './format/formatter.js';
import { nameKeyToDescKey as defaultNameKeyToDescKey, extractFlavorText } from './format/text-utils.js';
import { readCsvFile } from './io/csv-parser.js';
import { readIniFile, writeIniFile } from './io/ini-file.js';
import { readJsonFile } from './io/json-file.js';
import { buildLookupMap, loadMappingFile, saveMappingFile } from './io/mapping-store.js';
import { buildReverseNameIndex, resolveLocalizationKeys } from './key-resolver.js';
import { getLogger } from './logger.js';

const logger = getLogger('updater');

/** Localization keys must contain only word chars, hyphens, and dots. */
const VALID_KEY_PATTERN = /^[\w\-.]+$/;

export function validateRow(row, label) {
  const nameKey = row['Localization Key'];
  if (!nameKey || nameKey === 'N/A') return 'skip';
  if (!VALID_KEY_PATTERN.test(nameKey)) {
    logger.debug('Invalid localization key, skipping row', { label, key: nameKey });
    return 'invalid';
  }
  return 'valid';
}

/** Resolves base paths and option defaults. */
function resolveOptions(options) {
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

/** Validates a file path stays within a base directory (path traversal protection). */
function validateContainedPath(filePath, baseDir, label) {
  const resolved = path.resolve(filePath);
  const resolvedBase = path.resolve(baseDir);
  if (!resolved.startsWith(resolvedBase + path.sep) && resolved !== resolvedBase) {
    throw new Error(`Path traversal detected in ${label}: ${filePath}`);
  }
  return resolved;
}

function validateColumns(rows, requiredColumns, sourceLabel) {
  if (!requiredColumns || rows.length === 0) {
    return;
  }
  const columns = Object.keys(rows[0]);
  const missing = requiredColumns.filter((col) => !columns.includes(col));
  if (missing.length > 0) {
    throw new Error(`${sourceLabel} schema mismatch: missing columns: ${missing.join(', ')}`);
  }
}

async function loadJsonSourceData(config, csvDir) {
  const rawJsonPath = config.resolveJsonFile
    ? await config.resolveJsonFile(csvDir)
    : path.resolve(csvDir, config.jsonFile);
  const jsonPath = validateContainedPath(rawJsonPath, csvDir, 'JSON filename');
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

async function loadCsvSourceData(config, csvDir) {
  const csvPath = validateContainedPath(path.resolve(csvDir, config.csvFile), csvDir, 'CSV filename');
  logger.debug('Reading CSV file', { file: csvPath, label: config.label });
  const rows = await readCsvFile(csvPath);
  logger.debug('Parsed CSV rows', { count: rows.length, label: config.label });
  validateColumns(rows, config.requiredColumns, 'CSV');
  return rows;
}

/** Reads and validates CSV or JSON data against the config's required columns. */
async function loadSourceData(config, csvDir) {
  if (config.resolveJsonFile || config.jsonFile) {
    return loadJsonSourceData(config, csvDir);
  }
  return loadCsvSourceData(config, csvDir);
}

/** Resolves localization keys for SPViewer configs (no Localization Key column in CSV). */
async function resolveSpviewerKeys(rows, config, lines, csvDir, baseDir, dryRun) {
  const reverseIndex = buildReverseNameIndex(lines);
  const lookupMap = config.lookupCsvFile ? await loadLookupMap(config.lookupCsvFile, csvDir) : null;
  const mappingsDir = path.resolve(baseDir, 'mappings');
  const mappingBasename = path.basename(config.csvFile).replace(/\.csv$/i, '.json');
  const mappingFile = path.join(mappingsDir, mappingBasename);
  const savedMapping = await loadMappingFile(mappingFile);
  const { unresolved, mapping } = resolveLocalizationKeys(
    rows,
    config.nameColumn,
    reverseIndex,
    lookupMap,
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

async function loadLookupMap(lookupCsvFile, csvDir) {
  const lookupPath = validateContainedPath(path.resolve(csvDir, lookupCsvFile), csvDir, 'lookup CSV filename');
  return buildLookupMap(lookupPath);
}

/** Finds the last existing description key index for insertion ordering. */
function findLastDescIndex(existingKeys, descKeyMatch) {
  let lastDescIdx = -1;
  for (const [key, idx] of Object.entries(existingKeys)) {
    if (descKeyMatch(key.toLowerCase()) && idx > lastDescIdx) {
      lastDescIdx = idx;
    }
  }
  return lastDescIdx;
}

/** Processes a single row: updates existing key or queues a new entry. */
function getTargetKeys(config, row, deriveDescKey) {
  if (config.getTargetKeys) {
    return config.getTargetKeys(row, deriveDescKey);
  }
  const nameKey = row['Localization Key'];
  const descKey = deriveDescKey(nameKey);
  const altKeys = config.getAlternateDescKeys ? config.getAlternateDescKeys(descKey) : [];
  return [descKey, ...altKeys];
}

function processRow(row, context, deriveDescKey, _force = false) {
  const targetKeys = getTargetKeys(context.config, row, deriveDescKey);
  if (targetKeys.length === 0 || targetKeys.some((k) => context.updatedKeys.has(k.toLowerCase()))) {
    context.markSkipped();
    return;
  }

  let anyUpdated = false;
  let anyFound = false;

  for (const targetKey of targetKeys) {
    const found = findKey(targetKey, context.existingKeys);
    if (found) {
      anyFound = true;
      const oldLine = context.lines[found.idx];
      const eqIdx = oldLine.indexOf('=');
      const oldValue = eqIdx > -1 ? oldLine.substring(eqIdx + 1) : '';
      const flavor = extractFlavorText(oldValue);
      const newValue = sanitizeIniValue(context.config.buildValue(row, flavor, oldValue, found.key));
      if (newValue !== oldValue) {
        context.lines[found.idx] = `${found.key}=${newValue}`;
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

  context.markMissing(targetKeys[0]);
}

function shouldValidateRow(config, row) {
  return !(config.getTargetKeys && !row['Localization Key']);
}

function buildUnresolvedIssues(unresolvedNames) {
  return unresolvedNames.map((name) => ({
    key: name,
    reason: 'No localization key found',
    type: 'unresolved',
  }));
}

function createStats(issues, unresolvedCount) {
  return {
    updatedCount: 0,
    newCount: 0,
    skippedCount: 0,
    foundCount: 0,
    errorCount: 0,
    unresolvedCount,
    issues,
  };
}

function applyRowResult(result, config, newLines, stats) {
  if (result.status === 'updated') {
    stats.updatedCount++;
    return;
  }
  if (result.status === 'new') {
    if (config.noInsert) {
      stats.skippedCount++;
      return;
    }
    newLines.push(result.line);
    stats.newCount++;
    return;
  }
  if (result.status === 'found') {
    stats.foundCount++;
    return;
  }
  stats.skippedCount++;
}

function processRows(rows, config, deriveDescKey, existingKeys, lines, updatedKeys) {
  const newLines = [];
  const stats = createStats([], 0);

  for (const row of rows) {
    const validation = shouldValidateRow(config, row) ? validateRow(row, config.label) : 'valid';
    if (validation === 'skip') {
      stats.skippedCount++;
      continue;
    }
    if (validation === 'invalid') {
      stats.issues.push({ key: row['Localization Key'], reason: 'Invalid localization key', type: 'error' });
      stats.errorCount++;
      continue;
    }

    try {
      const result = processRow(row, config, deriveDescKey, existingKeys, lines, updatedKeys);
      applyRowResult(result, config, newLines, stats);
    } catch (err) {
      const nameKey = row['Localization Key'];
      logger.debug('Failed to process row, skipping', { label: config.label, key: nameKey, error: err.message });
      stats.issues.push({ key: nameKey, reason: `Build failed: ${err.message}`, type: 'error' });
      stats.errorCount++;
    }
  }

  return { newLines, stats };
}

function shouldWriteIni(opts, stats) {
  return !opts.dryRun && (stats.updatedCount > 0 || stats.newCount > 0 || (opts.force && stats.foundCount > 0));
}

/** Inserts new lines at the correct position (after last matching desc key). */
function insertNewEntries(lines, newLines, lastDescIdx) {
  if (newLines.length === 0) return;
  newLines.sort();
  if (lastDescIdx > -1) {
    for (let i = 0; i < newLines.length; i++) lines.splice(lastDescIdx + 1 + i, 0, newLines[i]);
  } else {
    lines.push(...newLines);
  }
}

export function validateIntegrity(originalLineCount, lines) {
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

class UpdateContext {
  constructor(config, lines, existingKeys, unresolvedNames, dryRun) {
    this.config = config;
    this.lines = lines;
    this.existingKeys = existingKeys;
    this.dryRun = dryRun;

    this.updatedKeys = new Set();
    this.newLines = [];
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

  markInvalid(key, reason = 'Invalid localization key') {
    this.issues.push({ key, reason, type: 'error' });
    this.errorCount++;
  }

  markError(key, error) {
    logger.debug('Failed to process row, skipping', { label: this.config.label, key, error: error.message });
    this.issues.push({ key, reason: `Build failed: ${error.message}`, type: 'error' });
    this.errorCount++;
  }

  markUpdated() {
    this.updatedCount++;
  }

  markNew(line) {
    this.newLines.push(line);
    this.newCount++;
  }

  markFound() {
    this.foundCount++;
  }

  markMissing(key) {
    logger.info('Missing key in target INI file, skipping', { label: this.config.label, key });
    this.issues.push({ key, reason: 'Key missing from global.ini', type: 'missing' });
    this.skippedCount++;
  }

  buildResult(durationMs) {
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

    logger.debug(summary, { label: this.config.label, ...stats, durationMs, dryRun: this.dryRun });

    return { label: this.config.label, ...stats, summary };
  }
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
export async function runUpdate(config, options = {}) {
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
        context.markError(row['Localization Key'], err);
      }
    }

    insertNewEntries(lines, context.newLines, lastDescIdx);

    validateIntegrity(originalLineCount, lines);

    if (!opts.dryRun && (context.updatedCount > 0 || context.newCount > 0 || (opts.force && context.foundCount > 0))) {
      await writeIniFile(opts.iniPath, lines, { skipBackup: opts.skipBackup });
    }

    const durationMs = Math.round(performance.now() - start);
    return context.buildResult(durationMs);
  } catch (err) {
    throw new Error(`Failed to update ${config.label}: ${err.message}`, { cause: err });
  }
}

function findKey(targetKey, existingKeys) {
  if (targetKey in existingKeys) {
    return { key: targetKey, idx: existingKeys[targetKey] };
  }
  const lc = targetKey.toLowerCase();
  for (const [k, idx] of Object.entries(existingKeys)) {
    if (k.toLowerCase() === lc) return { key: k, idx };
  }
  return null;
}
