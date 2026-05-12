import fs from 'node:fs/promises';
import path from 'node:path';
import { sanitizeIniValue } from './format/formatter.js';
import { nameKeyToDescKey as defaultNameKeyToDescKey, extractFlavorText } from './format/text-utils.js';
import { parseCSV } from './io/csv-parser.js';
import { readIniFile, writeIniFile } from './io/ini-file.js';
import { buildLookupMap, loadMappingFile, saveMappingFile } from './io/mapping-store.js';
import { buildReverseNameIndex, resolveLocalizationKeys } from './key-resolver.js';
import { getLogger } from './logger.js';

const logger = getLogger('updater');

/** Localization keys must contain only word chars, hyphens, and dots. */
const VALID_KEY_PATTERN = /^[\w\-.]+$/;

function validateRow(row, label) {
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

/** Reads and validates CSV or JSON data against the config's required columns. */
async function loadSourceData(config, csvDir) {
  if (config.resolveJsonFile || config.jsonFile) {
    const rawJsonPath = config.resolveJsonFile
      ? await config.resolveJsonFile(csvDir)
      : path.resolve(csvDir, config.jsonFile);
    const jsonPath = validateContainedPath(rawJsonPath, csvDir, 'JSON filename');
    logger.debug('Reading JSON file', { file: jsonPath, label: config.label });
    const jsonContent = await fs.readFile(jsonPath, 'utf-8');
    let data;
    try {
      data = JSON.parse(jsonContent);
    } catch (err) {
      throw new Error(`Invalid JSON file: ${err.message}`);
    }
    const rows = config.parseJson ? config.parseJson(data) : [];
    if (!Array.isArray(rows)) {
      throw new Error(`JSON parser must return an array for ${config.label}`);
    }
    logger.debug('Parsed JSON rows', { count: rows.length, label: config.label });

    if (config.requiredColumns && rows.length > 0) {
      const rowColumns = Object.keys(rows[0]);
      const missing = config.requiredColumns.filter((col) => !rowColumns.includes(col));
      if (missing.length > 0) {
        throw new Error(`JSON schema mismatch: missing columns: ${missing.join(', ')}`);
      }
    }
    return rows;
  }

  const csvPath = validateContainedPath(path.resolve(csvDir, config.csvFile), csvDir, 'CSV filename');
  logger.debug('Reading CSV file', { file: csvPath, label: config.label });
  const csvContent = await fs.readFile(csvPath, 'utf-8');
  const rows = parseCSV(csvContent);
  logger.debug('Parsed CSV rows', { count: rows.length, label: config.label });

  if (config.requiredColumns && rows.length > 0) {
    const csvColumns = Object.keys(rows[0]);
    const missing = config.requiredColumns.filter((col) => !csvColumns.includes(col));
    if (missing.length > 0) {
      throw new Error(`CSV schema mismatch: missing columns: ${missing.join(', ')}`);
    }
  }
  return rows;
}

/** Resolves localization keys for SPViewer configs (no Localization Key column in CSV). */
async function resolveSpviewerKeys(rows, config, lines, csvDir, baseDir, dryRun) {
  const reverseIndex = buildReverseNameIndex(lines);
  let lookupMap = null;
  if (config.lookupCsvFile) {
    const lookupPath = validateContainedPath(path.resolve(csvDir, config.lookupCsvFile), csvDir, 'lookup CSV filename');
    lookupMap = await buildLookupMap(lookupPath);
  }
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
  if (targetKeys.some((k) => context.updatedKeys.has(k.toLowerCase()))) {
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

  const newValue = sanitizeIniValue(context.config.buildValue(row, '', '', targetKeys[0]));
  context.markNew(`${targetKeys[0]}=${newValue}`);
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

    const unresolvedNames = config.nameColumn
      ? await resolveSpviewerKeys(rows, config, lines, opts.csvDir, opts.baseDir, opts.dryRun)
      : [];

    const deriveDescKey = config.nameKeyToDescKey || defaultNameKeyToDescKey;
    const lastDescIdx = findLastDescIndex(existingKeys, config.descKeyMatch);

    const context = new UpdateContext(config, lines, existingKeys, unresolvedNames, opts.dryRun);

    for (const row of rows) {
      const validation = validateRow(row, config.label);
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
