import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCSV } from '../io/csv-parser.js';
import { writeIniFile } from '../io/ini-file.js';
import { getLogger } from '../logger.js';
import {
  applyTagToFamily,
  buildVariantFamilyIndex,
  normalizeSpaces,
  parseNameLine,
  resolveBaseFromCurrentValue,
  toVariantFamilyKey,
} from './title-tag-utils.js';

const logger = getLogger('component-titles-update');

const MINING_CLASS_ABBREV = {
  Stealth: 'Sth',
  Industrial: 'Ind',
  Civilian: 'Civ',
  Competition: 'Cmp',
  Military: 'Mil',
};

function getMiningPrefix(cls, size, grade) {
  if (!cls || !size || !grade) {
    return null;
  }
  const abbr = MINING_CLASS_ABBREV[cls] || cls.slice(0, 3);
  return `${abbr}/${size}/${grade}`;
}

async function buildMiningTitleLookup(spviewerDir) {
  const files = (await fs.readdir(spviewerDir)).filter((name) => name.endsWith('.spviewer.csv')).sort();
  const nameToPrefix = new Map();

  for (const filename of files) {
    const filePath = path.join(spviewerDir, filename);
    const csvText = await fs.readFile(filePath, 'utf-8');
    const rows = parseCSV(csvText);

    for (const row of rows) {
      const name = normalizeSpaces(row.Name || '');
      if (!name) continue;
      const cls = (row.Class || '').trim();
      const size = (row.Size || '').trim();
      const grade = (row.Grade || '').trim();
      const prefix = getMiningPrefix(cls, size, grade);
      if (!prefix) continue;
      nameToPrefix.set(name.toLowerCase(), {
        name,
        prefix,
      });
    }
  }

  return { files, nameToPrefix };
}

function applyMiningTitlePrefixes(lines, nameToPrefix) {
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
    const base = resolveBaseFromCurrentValue(parsed.value, nameToPrefix);

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
      (cleanName) => `${base.prefix} ${cleanName}`,
    );
  }

  return { updatedLines, scannedCount, matchedCount, updatedCount };
}

/**
 * @param {object} params
 * @param {string} params.iniPath
 * @param {string} params.spviewerDir
 * @param {boolean} params.dryRun
 */
export async function runComponentTitleUpdate({ iniPath, spviewerDir, dryRun }) {
  const start = performance.now();
  const { files, nameToPrefix } = await buildMiningTitleLookup(spviewerDir);

  logger.info('Loaded mining title lookup data', {
    csvFileCount: files.length,
    componentCount: nameToPrefix.size,
  });

  const iniText = await fs.readFile(iniPath, 'utf-8');
  const lines = iniText.replace(/^\ufeff/, '').split(/\r?\n/);
  const { updatedLines, scannedCount, matchedCount, updatedCount } = applyMiningTitlePrefixes(lines, nameToPrefix);

  if (!dryRun && updatedCount > 0) {
    await writeIniFile(iniPath, updatedLines, { skipBackup: true });
  }

  const durationMs = Math.round(performance.now() - start);
  return {
    label: 'Component Titles',
    updatedCount,
    matchedCount,
    scannedCount,
    issues: [],
    summary: `Component Titles: Updated ${updatedCount}, Matched ${matchedCount}, Scanned ${scannedCount}${dryRun ? ' (dry run)' : ''} [${durationMs}ms]`,
  };
}
