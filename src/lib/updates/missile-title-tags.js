import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCSV } from '../io/csv-parser.js';
import { readIniFile, writeIniFile } from '../io/ini-file.js';
import { getLogger } from '../logger.js';
import { normalizeSpaces } from './title-tag-utils.js';

const logger = getLogger('missile-title-tags-update');

const MISSILE_SIGNAL_TAG = {
  CrossSection: 'CS',
  Electromagnetic: 'EM',
  Infrared: 'IR',
};

const MISSILE_KEY_PATTERN = /^(item_nameg?misl_.*?)(_short)?$/i;
const LEADING_TAG_PATTERN = /^\[(CS|EM|IR)\]\s*/i;

async function buildMissileSignalLookup(spviewerDir, repoRoot) {
  const missileCsvPath = path.join(spviewerDir, 'missile.spviewer.csv');
  const mappingPath = path.join(repoRoot, 'mappings', 'missile.spviewer.json');

  const [missileCsvText, mappingText] = await Promise.all([
    fs.readFile(missileCsvPath, 'utf-8'),
    fs.readFile(mappingPath, 'utf-8'),
  ]);

  const rows = parseCSV(missileCsvText);
  /** @type {Map<string, string>} */
  const nameToTag = new Map();
  for (const row of rows) {
    const name = normalizeSpaces(row.Name || '');
    const signal = normalizeSpaces(row['Tracking Signal'] || '');
    const tag = MISSILE_SIGNAL_TAG[signal];
    if (!name || !tag) continue;
    nameToTag.set(name, tag);
  }

  /** @type {Record<string, string>} */
  let mappingData = {};
  try {
    mappingData = JSON.parse(mappingText);
  } catch (err) {
    throw new Error(`Invalid missile mapping JSON: ${err.message}`);
  }

  /** @type {Map<string, string>} */
  const keyToTag = new Map();
  for (const [name, locKey] of Object.entries(mappingData)) {
    const tag = nameToTag.get(name);
    if (!tag) continue;
    keyToTag.set(locKey.toLowerCase(), tag);
  }

  return { keyToTag, nameCount: nameToTag.size };
}

function applyMissileSignalTags(lines, keyToTag) {
  const updatedLines = [];
  let scannedCount = 0;
  let matchedCount = 0;
  let updatedCount = 0;

  for (const line of lines) {
    const eqIdx = line.indexOf('=');
    if (eqIdx < 0) {
      updatedLines.push(line);
      continue;
    }

    const key = line.substring(0, eqIdx);
    const value = line.substring(eqIdx + 1);
    const keyMatch = MISSILE_KEY_PATTERN.exec(key);
    if (!keyMatch) {
      updatedLines.push(line);
      continue;
    }

    scannedCount++;
    const baseKey = keyMatch[1].toLowerCase();
    const tag = keyToTag.get(baseKey);
    if (!tag) {
      updatedLines.push(line);
      continue;
    }

    matchedCount++;
    const cleanValue = value.replace(LEADING_TAG_PATTERN, '').trimStart();
    const newValue = `[${tag}] ${cleanValue}`;
    if (newValue === value) {
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
 * @param {string} params.repoRoot
 * @param {boolean} params.dryRun
 */
export async function runMissileTitleTagUpdate({ iniPath, spviewerDir, repoRoot, dryRun }) {
  const start = performance.now();
  const { keyToTag, nameCount } = await buildMissileSignalLookup(spviewerDir, repoRoot);

  logger.info('Loaded missile signal lookup data', {
    localizationKeyCount: keyToTag.size,
    missileNameCount: nameCount,
  });

  const { lines } = await Promise.resolve(readIniFile(iniPath));
  const { updatedLines, scannedCount, matchedCount, updatedCount } = applyMissileSignalTags(lines, keyToTag);

  if (!dryRun && updatedCount > 0) {
    await writeIniFile(iniPath, updatedLines, { skipBackup: true });
  }

  const durationMs = Math.round(performance.now() - start);
  return {
    label: 'Missile title tags',
    updatedCount,
    matchedCount,
    scannedCount,
    issues: [],
    summary: `Missile title tags: Updated ${updatedCount}, Matched ${matchedCount}, Scanned ${scannedCount}${dryRun ? ' (dry run)' : ''} [${durationMs}ms]`,
  };
}
