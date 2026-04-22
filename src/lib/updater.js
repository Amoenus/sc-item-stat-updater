import fs from 'node:fs/promises';
import path from 'node:path';
import { sanitizeIniValue } from './format/formatter.js';
import { nameKeyToDescKey as defaultNameKeyToDescKey, extractFlavorText } from './format/text-utils.js';
import { parseCSV } from './io/csv-parser.js';
import { readIniFile, writeIniFile } from './io/ini-file.js';
import { buildLookupMap, loadMappingFile, saveMappingFile } from './io/mapping-store.js';
import { buildReverseNameIndex, resolveLocalizationKeys } from './key-resolver.js';
import { getLogger } from './logger.js';
import { preserveNamePrefix } from './localization-utils.js';

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

/** Reads and validates CSV data against the config's required columns. */
async function loadCsvData(csvPath, config) {
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

async function loadCsvRows(csvPath) {
  const csvContent = await fs.readFile(csvPath, 'utf-8');
  return parseCSV(csvContent);
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

async function resolveSpviewerLookupRows(config, csvDir) {
  if (!config.lookupCsvFile) return null;
  const lookupPath = validateContainedPath(path.resolve(csvDir, config.lookupCsvFile), csvDir, 'lookup CSV filename');
  return await loadCsvRows(lookupPath);
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
function buildNameValue(row, config, lookupRows) {
  if (typeof config.buildName === 'function') return config.buildName(row, lookupRows);
  if (config.nameColumn) return row[config.nameColumn];
  return null;
}

function normalizeNameAliasSuffix(key) {
  if (!key) return '';
  let normalized = String(key).trim();
  normalized = normalized.replace(/^item_([Nn]ame)(?:_)?/, '');
  normalized = normalized.replace(/_short$/i, '');
  if (normalized.toLowerCase().endsWith('_scitem')) {
    normalized = normalized.slice(0, -7);
  }
  return normalized.toLowerCase();
}

function processRow(row, config, deriveDescKey, existingKeys, lines, updatedKeys, lookupRows) {
  const nameKey = row['Localization Key'];
  const descKey = deriveDescKey(nameKey);
  const altKeys = config.getAlternateDescKeys ? config.getAlternateDescKeys(descKey) : [];
  const allKeys = [nameKey, descKey, ...altKeys];

  if (allKeys.some((k) => updatedKeys.has(k.toLowerCase()))) {
    return { status: 'skipped' };
  }

  let anyUpdated = false;
  let anyFound = false;

  const nameValue = buildNameValue(row, config, lookupRows);
  if (nameValue != null) {
    const foundName = findKey(nameKey, existingKeys);
    const canonicalNewValue = String(nameValue);
    if (foundName) {
      anyFound = true;
      const oldLine = lines[foundName.idx];
      const eqIdx = oldLine.indexOf('=');
      const oldValue = eqIdx > -1 ? oldLine.substring(eqIdx + 1) : '';
      const updatedValue = preserveNamePrefix(oldValue, canonicalNewValue);
      const sanitizedValue = sanitizeIniValue(updatedValue);
      if (sanitizedValue !== oldValue) {
        lines[foundName.idx] = `${foundName.key}=${sanitizedValue}`;
        anyUpdated = true;
      }
    }

    const aliasSuffix = normalizeNameAliasSuffix(nameKey);
    if (aliasSuffix) {
      for (const [candidateKey, idx] of Object.entries(existingKeys)) {
        if (candidateKey === nameKey) continue;
        if (!candidateKey.toLowerCase().startsWith('item_name')) continue;
        if (normalizeNameAliasSuffix(candidateKey) !== aliasSuffix) continue;

        const aliasLine = lines[idx];
        const aliasEqIdx = aliasLine.indexOf('=');
        if (aliasEqIdx < 0) continue;
        const aliasValue = aliasLine.substring(aliasEqIdx + 1);

        const updatedAliasValue = preserveNamePrefix(aliasValue, canonicalNewValue);
        const sanitizedAliasValue = sanitizeIniValue(updatedAliasValue);
        if (sanitizedAliasValue !== aliasValue) {
          lines[idx] = `${candidateKey}=${sanitizedAliasValue}`;
          anyUpdated = true;
          anyFound = true;
        }
      }
    }
  }

  for (const targetKey of [descKey, ...altKeys]) {
    const found = findKey(targetKey, existingKeys);
    if (found) {
      anyFound = true;
      const oldLine = lines[found.idx];
      const eqIdx = oldLine.indexOf('=');
      const oldValue = eqIdx > -1 ? oldLine.substring(eqIdx + 1) : '';
      const flavor = extractFlavorText(oldValue);
      const newValue = sanitizeIniValue(config.buildValue(row, flavor));
      if (newValue !== oldValue) {
        lines[found.idx] = `${found.key}=${newValue}`;
        anyUpdated = true;
      }
    }
  }

  if (anyUpdated) {
    for (const k of allKeys) updatedKeys.add(k.toLowerCase());
    return { status: 'updated' };
  }
  if (anyFound) {
    for (const k of allKeys) updatedKeys.add(k.toLowerCase());
    return { status: 'skipped' };
  }

  const newValue = sanitizeIniValue(config.buildValue(row, ''));
  return { status: 'new', line: `${descKey}=${newValue}` };
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

/** Builds the summary result object. */
function buildResult(config, stats, durationMs, dryRun) {
  const suffix = dryRun ? ' (dry run)' : '';
  const errorSuffix = stats.errorCount > 0 ? `, Errors ${stats.errorCount}` : '';
  const unresolvedSuffix = stats.unresolvedCount > 0 ? `, Unresolved ${stats.unresolvedCount}` : '';
  const summary = `${config.label}: Updated ${stats.updatedCount}, Added ${stats.newCount}, Skipped ${stats.skippedCount}${errorSuffix}${unresolvedSuffix}${suffix} [${durationMs}ms]`;

  logger.debug(summary, { label: config.label, ...stats, durationMs, dryRun });

  return { label: config.label, ...stats, issues: stats.issues, summary };
}

/**
 * Runs a CSV-based update against global.ini.
 *
 * @param {import('./types.js').ItemConfig} config
 * @param {object} [options]
 * @param {string} [options.iniPath] - Path to global.ini (default: ./global.ini relative to project root)
 * @param {string} [options.csvDir] - Directory containing CSV files (default: ./csv)
 * @param {boolean} [options.dryRun] - Preview changes without writing (default: false)
 * @param {boolean} [options.skipBackup] - Skip backup rotation (default: false)
 */
export async function runUpdate(config, options = {}) {
  const start = performance.now();
  const opts = resolveOptions(options);

  const csvPath = validateContainedPath(path.resolve(opts.csvDir, config.csvFile), opts.csvDir, 'CSV filename');

  try {
    await fs.access(csvPath);
  } catch {
    throw new Error(`CSV file not found: ${csvPath}`);
  }
  try {
    await fs.access(opts.iniPath);
  } catch {
    throw new Error(`INI file not found: ${opts.iniPath}`);
  }

  try {
    const rows = await loadCsvData(csvPath, config);
    const { lines, index: existingKeys } = await readIniFile(opts.iniPath);

    const unresolvedNames = config.nameColumn
      ? await resolveSpviewerKeys(rows, config, lines, opts.csvDir, opts.baseDir, opts.dryRun)
      : [];

    const deriveDescKey = config.nameKeyToDescKey || defaultNameKeyToDescKey;
    const lastDescIdx = findLastDescIndex(existingKeys, config.descKeyMatch);
    const updatedKeys = new Set();
    const newLines = [];
    const issues = unresolvedNames.map((name) => ({ key: name, reason: 'No localization key found', type: 'unresolved' }));
    let updatedCount = 0,
      newCount = 0,
      skippedCount = 0,
      errorCount = 0;

    const lookupRows = await resolveSpviewerLookupRows(config, opts.csvDir);
    for (const row of rows) {
      const validation = validateRow(row, config.label);
      if (validation === 'skip') {
        skippedCount++;
        continue;
      }
      if (validation === 'invalid') {
        issues.push({ key: row['Localization Key'], reason: 'Invalid localization key', type: 'error' });
        errorCount++;
        continue;
      }

      try {
        const result = processRow(row, config, deriveDescKey, existingKeys, lines, updatedKeys, lookupRows);
        if (result.status === 'updated') updatedCount++;
        else if (result.status === 'new') {
          newLines.push(result.line);
          newCount++;
        } else skippedCount++;
      } catch (err) {
        const nameKey = row['Localization Key'];
        logger.debug('Failed to process row, skipping', { label: config.label, key: nameKey, error: err.message });
        issues.push({ key: nameKey, reason: `Build failed: ${err.message}`, type: 'error' });
        errorCount++;
      }
    }

    insertNewEntries(lines, newLines, lastDescIdx);

    if (!opts.dryRun && (updatedCount > 0 || newCount > 0)) {
      await writeIniFile(opts.iniPath, lines, { skipBackup: opts.skipBackup });
    }

    const durationMs = Math.round(performance.now() - start);
    return buildResult(
      config,
      { updatedCount, newCount, skippedCount, errorCount, unresolvedCount: unresolvedNames.length, issues },
      durationMs,
      opts.dryRun,
    );
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
