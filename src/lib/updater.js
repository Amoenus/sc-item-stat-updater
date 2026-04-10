import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCSV } from './csv-parser.js';
import { sanitizeIniValue } from './formatter.js';
import { readIniFile, writeIniFile } from './ini-file.js';
import { getLogger } from './logger.js';
import { nameKeyToDescKey as defaultNameKeyToDescKey, extractFlavorText } from './text-utils.js';

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

/**
 * Runs a CSV-based update against global.ini.
 *
 * @param {import('./types.js').ItemConfig} config
 * @param {object} [options]
 * @param {string} [options.iniPath] - Path to global.ini (default: ./global.ini relative to project root)
 * @param {string} [options.csvDir] - Directory containing CSV files (default: ./csv)
 * @param {boolean} [options.dryRun] - Preview changes without writing (default: false)
 */
export async function runUpdate(config, options = {}) {
  const start = performance.now();

  const baseDir = path.resolve(import.meta.dirname, '..', '..');
  const iniPath = options.iniPath || path.join(baseDir, 'global.ini');
  const csvDir = options.csvDir || path.join(baseDir, 'csv');
  const dryRun = options.dryRun || false;

  const csvPath = path.resolve(csvDir, config.csvFile);

  // Path traversal protection: ensure CSV file stays within its directory
  if (!csvPath.startsWith(path.resolve(csvDir) + path.sep) && csvPath !== path.resolve(csvDir)) {
    throw new Error(`Path traversal detected in CSV filename: ${config.csvFile}`);
  }

  try {
    await fs.access(csvPath);
  } catch {
    throw new Error(`CSV file not found: ${csvPath}`);
  }
  try {
    await fs.access(iniPath);
  } catch {
    throw new Error(`INI file not found: ${iniPath}`);
  }

  try {
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

    const { lines, index: existingKeys } = await readIniFile(iniPath);
    const deriveDescKey = config.nameKeyToDescKey || defaultNameKeyToDescKey;

    let updatedCount = 0,
      newCount = 0,
      skippedCount = 0,
      errorCount = 0;
    const newLines = [];
    const issues = [];
    let lastDescIdx = -1;

    for (const [key, idx] of Object.entries(existingKeys)) {
      if (config.descKeyMatch(key.toLowerCase())) {
        if (idx > lastDescIdx) lastDescIdx = idx;
      }
    }

    for (const r of rows) {
      const validation = validateRow(r, config.label);
      if (validation === 'skip') {
        skippedCount++;
        continue;
      }
      if (validation === 'invalid') {
        issues.push({ key: r['Localization Key'], reason: 'Invalid localization key' });
        errorCount++;
        continue;
      }

      const nameKey = r['Localization Key'];
      const descKey = deriveDescKey(nameKey);
      const altKeys = config.getAlternateDescKeys ? config.getAlternateDescKeys(descKey) : [];
      const allKeys = [descKey, ...altKeys];
      let anyUpdated = false;
      let hadError = false;

      for (const targetKey of allKeys) {
        const found = findKey(targetKey, existingKeys);
        if (found) {
          try {
            const oldLine = lines[found.idx];
            const eqIdx = oldLine.indexOf('=');
            const oldValue = eqIdx > -1 ? oldLine.substring(eqIdx + 1) : '';
            const flavor = extractFlavorText(oldValue);
            const newValue = sanitizeIniValue(config.buildValue(r, flavor));
            lines[found.idx] = `${found.key}=${newValue}`;
            anyUpdated = true;
          } catch (err) {
            logger.debug('Failed to build value for row, skipping', {
              label: config.label,
              key: nameKey,
              error: err.message,
            });
            issues.push({ key: nameKey, reason: `Build failed: ${err.message}` });
            hadError = true;
          }
        }
      }

      if (hadError) {
        errorCount++;
      } else if (anyUpdated) {
        updatedCount++;
      } else {
        try {
          const newValue = sanitizeIniValue(config.buildValue(r, ''));
          newLines.push(`${descKey}=${newValue}`);
          newCount++;
        } catch (err) {
          logger.debug('Failed to build value for new row, skipping', {
            label: config.label,
            key: nameKey,
            error: err.message,
          });
          issues.push({ key: nameKey, reason: `Build failed: ${err.message}` });
          errorCount++;
        }
      }
    }

    if (newLines.length > 0 && lastDescIdx > -1) {
      newLines.sort();
      for (let i = 0; i < newLines.length; i++) lines.splice(lastDescIdx + 1 + i, 0, newLines[i]);
    } else if (newLines.length > 0) {
      lines.push(...newLines.sort());
    }

    if (!dryRun) {
      await writeIniFile(iniPath, lines);
    }

    const durationMs = Math.round(performance.now() - start);
    const suffix = dryRun ? ' (dry run)' : '';
    const errorSuffix = errorCount > 0 ? `, Errors ${errorCount}` : '';
    const summary = `${config.label}: Updated ${updatedCount}, Added ${newCount}, Skipped ${skippedCount}${errorSuffix}${suffix} [${durationMs}ms]`;

    logger.debug(summary, {
      label: config.label,
      updatedCount,
      newCount,
      skippedCount,
      errorCount,
      durationMs,
      dryRun,
    });

    return { label: config.label, updatedCount, newCount, skippedCount, errorCount, issues, summary };
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
