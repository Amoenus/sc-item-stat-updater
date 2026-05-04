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

const logger = getLogger('fps-title-tags-update');

const PERSONAL_CSV = 'weaponpersonal.spviewer.csv';
const ATTACHMENT_CSV = 'weaponattachment.spviewer.csv';

function normalizeTypeCode(value) {
  const type = String(value || '').toLowerCase();
  if (type.includes('sniper')) return 'SNP';
  if (type.includes('shotgun')) return 'SG';
  if (type.includes('smg')) return 'SMG';
  if (type.includes('lmg')) return 'LMG';
  if (type.includes('pistol')) return 'PST';
  if (type.includes('rifle')) return 'RFL';
  return 'WPN';
}

function normalizeDamageCode(row) {
  const physical = Number(row['Damage DPS Physical'] || '0');
  const energy = Number(row['Damage DPS Energy'] || '0');
  const distortion = Number(row['Damage DPS Distortion'] || '0');
  const stun = Number(row['Damage DPS Stun'] || '0');

  if (physical > 0 && physical >= energy && physical >= distortion && physical >= stun) return 'BAL';
  if (energy > 0 && energy >= physical && energy >= distortion && energy >= stun) return 'ENG';
  if (distortion > 0) return 'DIS';
  if (stun > 0) return 'STN';

  const type = String(row.Type || '').toLowerCase();
  if (type.includes('ballistic')) return 'BAL';
  if (type.includes('energy') || type.includes('laser')) return 'ENG';
  if (type.includes('distortion')) return 'DIS';

  return null;
}

function normalizeSlotCode(value, type) {
  const slot = String(value || '').toLowerCase();
  const lowerType = String(type || '').toLowerCase();

  if (slot.includes('optic') || slot.includes('scope')) return 'OPT';
  if (slot.includes('barrel') && slot.includes('under')) return 'UBR';
  if (slot.includes('barrel')) return 'BRL';
  if (slot.includes('muzzle')) return 'MZL';
  if (slot.includes('under')) return 'UBR';
  if (lowerType.includes('flashlight')) return 'FLS';
  if (lowerType.includes('laser')) return 'LSR';

  return 'ATT';
}

function buildPersonalTag(row) {
  const size = String(row.Size || '').trim();
  const typeCode = normalizeTypeCode(row.Type || row.Name || '');
  const damageCode = normalizeDamageCode(row);
  const parts = [`S${size || '?'}`, typeCode];
  if (damageCode) {
    parts.push(damageCode);
  }
  return parts.join('|');
}

function buildAttachmentTag(row) {
  const size = String(row.Size || '').trim();
  const slotCode = normalizeSlotCode(row.Slot, row.Type);
  return [`S${size || '?'}`, slotCode].join('|');
}

async function buildFpsTitleLookup(spviewerDir) {
  const personalPath = path.join(spviewerDir, PERSONAL_CSV);
  const attachmentPath = path.join(spviewerDir, ATTACHMENT_CSV);
  const [personalCsv, attachmentCsv] = await Promise.all([
    fs.readFile(personalPath, 'utf-8'),
    fs.readFile(attachmentPath, 'utf-8'),
  ]);

  const nameToTag = new Map();

  for (const row of parseCSV(personalCsv)) {
    const name = normalizeSpaces(row.Name || '');
    if (!name) continue;
    nameToTag.set(name.toLowerCase(), { name, tag: buildPersonalTag(row) });
  }

  for (const row of parseCSV(attachmentCsv)) {
    const name = normalizeSpaces(row.Name || '');
    if (!name) continue;
    nameToTag.set(name.toLowerCase(), { name, tag: buildAttachmentTag(row) });
  }

  return nameToTag;
}

function isFpsNameKey(keyLower) {
  return (
    keyLower.includes('_pistol') ||
    keyLower.includes('_smg') ||
    keyLower.includes('_rifle') ||
    keyLower.includes('_sniper') ||
    keyLower.includes('_shotgun') ||
    keyLower.includes('_lmg') ||
    keyLower.includes('_ubarrel') ||
    keyLower.includes('_barrel') ||
    keyLower.includes('_optics') ||
    keyLower.includes('_scope') ||
    keyLower.includes('_attachment')
  );
}

function applyFpsTitleTags(lines, nameToTag) {
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
    const keyLower = parsed.key.toLowerCase();
    if (!isFpsNameKey(keyLower)) {
      continue;
    }

    const base = resolveBaseFromCurrentValue(parsed.value, nameToTag);
    if (!base) {
      continue;
    }

    matchedCount++;
    const familyKey = toVariantFamilyKey(parsed.key);
    if (processedFamilies.has(familyKey)) {
      continue;
    }

    processedFamilies.add(familyKey);
    updatedCount += applyTagToFamily(updatedLines, familyIndex, familyKey, (cleanName) => `[${base.tag}] ${cleanName}`);
  }

  return {
    updatedLines,
    scannedCount,
    matchedCount,
    updatedCount,
  };
}

/**
 * @param {object} params
 * @param {string} params.iniPath
 * @param {string} params.spviewerDir
 * @param {boolean} params.dryRun
 */
export async function runFpsTitleTagUpdate({ iniPath, spviewerDir, dryRun }) {
  const start = performance.now();
  const nameToTag = await buildFpsTitleLookup(spviewerDir);

  logger.info('Loaded FPS title lookup data', {
    titleCount: nameToTag.size,
  });

  const iniText = await fs.readFile(iniPath, 'utf-8');
  const lines = iniText.replace(/^\ufeff/, '').split(/\r?\n/);
  const { updatedLines, scannedCount, matchedCount, updatedCount } = applyFpsTitleTags(lines, nameToTag);

  if (!dryRun && updatedCount > 0) {
    await writeIniFile(iniPath, updatedLines, { skipBackup: true });
  }

  const durationMs = Math.round(performance.now() - start);
  return {
    label: 'FPS title tags',
    updatedCount,
    matchedCount,
    scannedCount,
    issues: [],
    summary: `FPS title tags: Updated ${updatedCount}, Matched ${matchedCount}, Scanned ${scannedCount}${dryRun ? ' (dry run)' : ''} [${durationMs}ms]`,
  };
}
