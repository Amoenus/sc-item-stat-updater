import { readCsvFile } from '../../io/local/csv-parser';
import { readIniFile, writeIniFileIfChanged } from '../../io/local/ini-file';
import { resolveSpviewerCsvPath } from '../../io/local/path-conventions';
import { getLogger } from '../logger';
import { buildLookupMapFromRows } from './lookup-utils';
import {
  applyTagToFamily,
  buildVariantFamilyIndex,
  normalizeSpaces,
  parseNameLine,
  resolveBaseFromCurrentValue,
  toVariantFamilyKey,
} from './title-tag-utils';
import { buildScannedUpdateResult } from './update-result';

const logger = getLogger('fps-title-tags-update');

const PERSONAL_CSV = 'weaponpersonal.spviewer.csv';
const ATTACHMENT_CSV = 'weaponattachment.spviewer.csv';

function normalizeTypeCode(value: string | undefined): string {
  const type = (value ?? '').toLowerCase();
  if (type.includes('sniper')) return 'SNP';
  if (type.includes('shotgun')) return 'SG';
  if (type.includes('smg')) return 'SMG';
  if (type.includes('lmg')) return 'LMG';
  if (type.includes('pistol')) return 'PST';
  if (type.includes('rifle')) return 'RFL';
  return 'WPN';
}

function normalizeDamageCode(row: Record<string, string>): string | null {
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

function normalizeSlotCode(value: string | undefined, type: string | undefined): string {
  const slot = (value ?? '').toLowerCase();
  const lowerType = (type ?? '').toLowerCase();

  if (slot.includes('optic') || slot.includes('scope')) return 'OPT';
  if (slot.includes('barrel') && slot.includes('under')) return 'UBR';
  if (slot.includes('barrel')) return 'BRL';
  if (slot.includes('muzzle')) return 'MZL';
  if (slot.includes('under')) return 'UBR';
  if (lowerType.includes('flashlight')) return 'FLS';
  if (lowerType.includes('laser')) return 'LSR';

  return 'ATT';
}

function buildPersonalTag(row: Record<string, string>): string {
  const size = String(row.Size || '').trim();
  const typeCode = normalizeTypeCode(row.Type || row.Name || '');
  const damageCode = normalizeDamageCode(row);
  const parts = [`S${size || '?'}`, typeCode];
  if (damageCode) {
    parts.push(damageCode);
  }
  return parts.join('|');
}

function buildAttachmentTag(row: Record<string, string>): string {
  const size = String(row.Size || '').trim();
  const slotCode = normalizeSlotCode(row.Slot, row.Type);
  return [`S${size || '?'}`, slotCode].join('|');
}

async function buildFpsTitleLookup(spviewerDir: string) {
  const personalPath = resolveSpviewerCsvPath(spviewerDir, PERSONAL_CSV);
  const attachmentPath = resolveSpviewerCsvPath(spviewerDir, ATTACHMENT_CSV);
  const [personalRows, attachmentRows] = await Promise.all([readCsvFile(personalPath), readCsvFile(attachmentPath)]);

  const nameToTag = buildLookupMapFromRows(personalRows, (row) => {
    const name = normalizeSpaces(row.Name || '');
    if (!name) return null;
    return [name.toLowerCase(), { name, tag: buildPersonalTag(row) }];
  });

  for (const [key, value] of buildLookupMapFromRows(attachmentRows, (row) => {
    const name = normalizeSpaces(row.Name || '');
    if (!name) return null;
    return [name.toLowerCase(), { name, tag: buildAttachmentTag(row) }];
  })) {
    nameToTag.set(key, value);
  }

  return nameToTag;
}

function isFpsNameKey(keyLower: string): boolean {
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

function applyFpsTitleTags(lines: string[], nameToTag: Map<string, { name: string; tag: string }>) {
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
    updatedCount += applyTagToFamily(
      updatedLines,
      familyIndex,
      familyKey,
      (cleanName: string) => `[${base.tag}] ${cleanName}`,
    );
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
export async function runFpsTitleTagUpdate({
  iniPath,
  spviewerDir,
  dryRun,
}: {
  iniPath: string;
  spviewerDir: string;
  dryRun: boolean;
}) {
  const start = performance.now();
  const nameToTag = await buildFpsTitleLookup(spviewerDir);

  logger.info('Loaded FPS title lookup data', {
    titleCount: nameToTag.size,
  });

  const iniData = await readIniFile(iniPath);
  const { lines } = iniData;
  const { updatedLines, scannedCount, matchedCount, updatedCount } = applyFpsTitleTags(lines, nameToTag);

  await writeIniFileIfChanged(iniPath, updatedLines, { dryRun, updatedCount, skipBackup: true });

  const durationMs = Math.round(performance.now() - start);
  return buildScannedUpdateResult({
    label: 'FPS title tags',
    updatedCount,
    matchedCount,
    scannedCount,
    dryRun,
    durationMs,
  });
}
