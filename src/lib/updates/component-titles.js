import path from 'node:path';
import fs from 'node:fs/promises';
import { parseCSV } from '../io/csv-parser.js';
import { writeIniFile } from '../io/ini-file.js';
import { getLogger } from '../logger.js';

const logger = getLogger('component-titles-update');

const MINING_CLASS_ABBREV = {
  Stealth: 'Sth',
  Industrial: 'Ind',
  Civilian: 'Civ',
  Competition: 'Cmp',
  Military: 'Mil',
};

const COMPONENT_NAME_LINE_PATTERN = /^(item_name_?.*?)=(.*)$/i;
const PREFIXED_COMPONENT_NAME_PATTERN = /^\S+\s+(.+)$/u;

function normalizeSpaces(value) {
  return String(value || '')
    .replaceAll(/[\u00a0\u202f]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function getMiningPrefix(cls, size, grade) {
  const abbr = MINING_CLASS_ABBREV[cls] || (cls ? cls.slice(0, 3) : '???');
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
      nameToPrefix.set(name.toLowerCase(), {
        name,
        prefix: getMiningPrefix(cls, size, grade),
      });
    }
  }

  return { files, nameToPrefix };
}

function resolveBaseName(currentValue, nameToPrefix) {
  const normalized = normalizeSpaces(currentValue);
  if (!normalized) return null;

  const exact = nameToPrefix.get(normalized.toLowerCase());
  if (exact) return exact;

  const prefixed = PREFIXED_COMPONENT_NAME_PATTERN.exec(normalized);
  if (prefixed) {
    const base = nameToPrefix.get(prefixed[1].toLowerCase());
    if (base) return base;
  }

  return null;
}

function applyMiningTitlePrefixes(lines, nameToPrefix) {
  const updatedLines = [];
  let scannedCount = 0;
  let matchedCount = 0;
  let updatedCount = 0;

  for (const line of lines) {
    const match = COMPONENT_NAME_LINE_PATTERN.exec(line);
    if (!match) {
      updatedLines.push(line);
      continue;
    }

    scannedCount++;
    const key = match[1];
    const currentValue = match[2];
    const base = resolveBaseName(currentValue, nameToPrefix);

    if (!base) {
      updatedLines.push(line);
      continue;
    }

    matchedCount++;
    const newValue = `${base.prefix} ${base.name}`;
    if (newValue === currentValue) {
      updatedLines.push(line);
      continue;
    }

    updatedLines.push(`${key}=${newValue}`);
    updatedCount++;
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
