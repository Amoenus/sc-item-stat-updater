import { getLogger } from '../../infrastructure/logger';
import { readCsvFile } from '../../io/local/csv-parser';
import { resolveChildPath } from '../../io/local/path-conventions';
import { readIniFile, writeIniFileIfChanged } from '../../localization/ini-file';
import type { DataCoreRelationshipIndex } from '../../sources/datacore/relationship-index';
import { getGraphTitleLocalizationKeys, loadOptionalDataCoreRelationshipIndex } from './datacore-title-key-utils';
import { buildLookupMapFromRows } from './lookup-utils';
import {
  applyTagToFamily,
  buildVariantFamilyIndex,
  normalizeSpaces,
  parseNameLine,
  toVariantFamilyKey,
} from './title-tag-utils';
import { buildScannedUpdateResult } from './update-result';

const logger = getLogger('fps-title-tags-update');

const DATACORE_PERSONAL_CSV = 'weaponpersonal.datacore.csv';
const DATACORE_ATTACHMENT_CSV = 'weaponattachment.datacore.csv';

const TYPE_CODE_RULES: Array<readonly [string, string]> = [
  ['grenade launcher', 'GL'],
  ['glauncher', 'GL'],
  ['rocket launcher', 'RL'],
  ['missile launcher', 'ML'],
  ['knife', 'KNF'],
  ['melee', 'KNF'],
  ['sniper', 'SNP'],
  ['shotgun', 'SG'],
  ['smg', 'SMG'],
  ['lmg', 'LMG'],
  ['pistol', 'PST'],
  ['rifle', 'RFL'],
];

const GRAPH_TYPE_CODE_RULES: Array<readonly [RegExp, string]> = [
  [/displaytype_meleeweapon\b|\/weapons\/melee\//i, 'KNF'],
  [/displaytype_sniper\b/i, 'SNP'],
  [/displaytype_shotgun\b/i, 'SG'],
  [/displaytype_smg\b/i, 'SMG'],
  [/displaytype_lmg\b/i, 'LMG'],
  [/displaytype_pistol\b/i, 'PST'],
  [/displaytype_rifle\b/i, 'RFL'],
  [/displaytype_shouldered\b/i, 'SHD'],
  [/displaytype_special\b/i, 'SPC'],
];

const DAMAGE_COLUMNS: Array<readonly [string, string]> = [
  ['Damage DPS Physical', 'BAL'],
  ['Damage DPS Energy', 'ENG'],
  ['Damage DPS Distortion', 'DIS'],
  ['Damage DPS Stun', 'STN'],
];

const PRIMARY_DAMAGE_CODES = ['BAL', 'ENG'];
const SECONDARY_DAMAGE_CODES = ['DIS', 'STN'];

const DAMAGE_TYPE_RULES: Array<readonly [string, string]> = [
  ['ballistic', 'BAL'],
  ['energy', 'ENG'],
  ['laser', 'ENG'],
  ['distortion', 'DIS'],
];

const SLOT_CODE_RULES: Array<readonly [string, string]> = [
  ['optic', 'OPT'],
  ['scope', 'OPT'],
  ['muzzle', 'MZL'],
  ['under', 'UBR'],
  ['barrel', 'BRL'],
];

const TYPE_SLOT_CODE_RULES: Array<readonly [string, string]> = [
  ['flashlight', 'FLS'],
  ['laser', 'LSR'],
];

function normalizeTypeCode(value: string | undefined): string {
  const type = (value ?? '').toLowerCase();
  return TYPE_CODE_RULES.find(([fragment]) => type.includes(fragment))?.[1] ?? 'WPN';
}

function weaponTypeHaystack(row: Record<string, string>): string {
  return [
    row.Type,
    row.Name,
    row.Class,
    row['Entity Class'],
    row['Name Key'],
    row['Short Name Key'],
    row['Description Key'],
  ].join(' ');
}

function graphWeaponTypeHaystack(row: Record<string, string>, relationships: DataCoreRelationshipIndex): string {
  const record = relationships.getRecordForEntityClass(row['Entity Class']);
  if (!record) return '';
  if (!/\/entities\/scitem\/weapons\//i.test(record.path)) return '';

  return [
    record.path,
    record.rootTag,
    record.rootType,
    record.entityClass,
    ...record.localizationKeys.map(({ attribute, key }) => `${attribute}:${key}`),
  ].join(' ');
}

function normalizeGraphTypeCode(row: Record<string, string>, relationships: DataCoreRelationshipIndex): string | null {
  if (row.Class?.toLowerCase() === 'gadget') return null;

  const haystack = graphWeaponTypeHaystack(row, relationships);
  return GRAPH_TYPE_CODE_RULES.find(([pattern]) => pattern.test(haystack))?.[1] ?? null;
}

function resolvePersonalTypeCode(row: Record<string, string>, relationships: DataCoreRelationshipIndex | null): string {
  const graphTypeCode = relationships ? normalizeGraphTypeCode(row, relationships) : null;
  const fallbackTypeCode = normalizeTypeCode(weaponTypeHaystack(row));

  if (graphTypeCode && fallbackTypeCode !== 'WPN') {
    return fallbackTypeCode;
  }
  return graphTypeCode ?? fallbackTypeCode;
}

function normalizeDamageCode(row: Record<string, string>): string | null {
  const damageValues = new Map(DAMAGE_COLUMNS.map(([column, code]) => [code, Number(row[column] || '0')]));
  const maxDamage = Math.max(...damageValues.values());
  const primaryDamage = PRIMARY_DAMAGE_CODES.find(
    (code) => (damageValues.get(code) ?? 0) > 0 && damageValues.get(code) === maxDamage,
  );
  const secondaryDamage = SECONDARY_DAMAGE_CODES.find((code) => (damageValues.get(code) ?? 0) > 0);
  if (primaryDamage || secondaryDamage) return primaryDamage ?? secondaryDamage ?? null;

  const type = String(row.Type || row['Entity Class'] || row['Name Key'] || row.Class || '').toLowerCase();
  return DAMAGE_TYPE_RULES.find(([fragment]) => type.includes(fragment))?.[1] ?? null;
}

function normalizeSlotCode(value: string | undefined, type: string | undefined): string {
  const slot = (value ?? '').toLowerCase();
  const lowerType = (type ?? '').toLowerCase();

  if (slot.includes('barrel') && slot.includes('under')) return 'UBR';
  const slotCode = SLOT_CODE_RULES.find(([fragment]) => slot.includes(fragment))?.[1];
  if (slotCode) return slotCode;

  return TYPE_SLOT_CODE_RULES.find(([fragment]) => lowerType.includes(fragment))?.[1] ?? 'ATT';
}

function buildPersonalTag(row: Record<string, string>, relationships: DataCoreRelationshipIndex | null = null): string {
  const size = String(row.Size || '').trim();
  const typeCode = resolvePersonalTypeCode(row, relationships);
  const damageCode = normalizeDamageCode(row);
  const parts = [`S${size || '?'}`, typeCode];
  if (damageCode) {
    parts.push(damageCode);
  }
  return parts.join('|');
}

function buildAttachmentTag(row: Record<string, string>): string {
  const size = String(row.Size || '').trim();
  const slotCode = normalizeSlotCode(row.Slot, row.Type || row.Class);
  return [`S${size || '?'}`, slotCode].join('|');
}

async function buildFpsTitleLookupFromDataCore(datacoreDir: string) {
  const personalPath = resolveChildPath(datacoreDir, DATACORE_PERSONAL_CSV, 'DataCore FPS personal CSV filename');
  const attachmentPath = resolveChildPath(datacoreDir, DATACORE_ATTACHMENT_CSV, 'DataCore FPS attachment CSV filename');
  const [personalRows, attachmentRows, relationships] = await Promise.all([
    readCsvFile(personalPath),
    readCsvFile(attachmentPath),
    loadOptionalDataCoreRelationshipIndex(datacoreDir),
  ]);

  const keyToTag = new Map<string, { tag: string }>();
  for (const row of personalRows) {
    const tag = buildPersonalTag(row, relationships);
    for (const key of getGraphTitleLocalizationKeys(row, relationships)) {
      keyToTag.set(key, { tag });
    }
  }
  for (const row of attachmentRows) {
    const tag = buildAttachmentTag(row);
    for (const key of getGraphTitleLocalizationKeys(row, relationships)) {
      keyToTag.set(key, { tag });
    }
  }

  for (const [key, value] of buildLookupMapFromRows(personalRows, (row) => {
    const key = normalizeLocalizationKey(row['Name Key']);
    if (!isUsableLocalizationKey(key)) return null;
    return [key, { tag: buildPersonalTag(row, relationships) }];
  })) {
    setFallbackLookupValue(keyToTag, key, value);
  }

  for (const [key, value] of buildLookupMapFromRows(attachmentRows, (row) => {
    const key = normalizeLocalizationKey(row['Name Key']);
    if (!isUsableLocalizationKey(key)) return null;
    return [key, { tag: buildAttachmentTag(row) }];
  })) {
    setFallbackLookupValue(keyToTag, key, value);
  }

  return keyToTag;
}

function normalizeLocalizationKey(value: unknown): string {
  return normalizeSpaces(value).replace(/^@/, '').toLowerCase();
}

function isUsableLocalizationKey(key: string): boolean {
  return key !== '' && !/^loc_(?:empty|placeholder|uninitialized)$/i.test(key);
}

function setFallbackLookupValue<V>(lookup: Map<string, V>, key: string, value: V): void {
  if (!lookup.has(key)) lookup.set(key, value);
}

function applyFpsTitleTags(lines: string[], keyToTag: Map<string, { tag: string }>) {
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
    const base = keyToTag.get(normalizeLocalizationKey(parsed.key));
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
 * @param {string} params.datacoreDir
 * @param {boolean} params.dryRun
 */
export async function runFpsTitleTagUpdate({
  iniPath,
  datacoreDir,
  dryRun,
}: {
  iniPath: string;
  datacoreDir: string;
  dryRun: boolean;
}) {
  const start = performance.now();
  const keyToTag = await buildFpsTitleLookupFromDataCore(datacoreDir);

  logger.info('Loaded FPS title lookup data', {
    titleCount: keyToTag.size,
  });

  const iniData = await readIniFile(iniPath);
  const { lines } = iniData;
  const { updatedLines, scannedCount, matchedCount, updatedCount } = applyFpsTitleTags(lines, keyToTag);

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
