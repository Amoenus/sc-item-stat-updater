import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import type { DataCoreMiningRockSignatureRecord, DataCoreRecordGraphLookup } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_MINEABLE_ENTITY_PATH_PREFIX = 'libs/foundry/records/entities/mineable';
const SCAN_SIGNATURE_INDEX = 4;
const VARIANT_FAMILY_PATTERNS: Array<{ pattern: RegExp; family: DataCoreMiningRockSignatureRecord['variantFamily'] }> =
  [
    { pattern: /^MineableRock_Asteroid(?<rarity>Common|Uncommon|Rare|Epic|Legendary)_/i, family: 'asteroid' },
    { pattern: /^MineableRock_Surface(?<rarity>Common|Uncommon|Rare|Epic|Legendary)_/i, family: 'surface' },
    { pattern: /^MineableRock_FPS_/i, family: 'fps' },
    { pattern: /^MineableRock_GroundVehicle_/i, family: 'groundvehicle' },
  ];
const SIZE_SUFFIX_PATTERN = /_(RCD_)?(?:large|small|medium|half)$/i;

export interface ExtractDataCoreMiningRockSignaturesOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  pathPrefix?: string;
}

export async function extractDataCoreMiningRockSignatures(
  options: ExtractDataCoreMiningRockSignaturesOptions,
): Promise<DataCoreMiningRockSignatureRecord[]> {
  const records = options.graph
    .getByPathPrefix(options.pathPrefix ?? DEFAULT_MINEABLE_ENTITY_PATH_PREFIX)
    .filter((record) => record.rootType === 'EntityClassDefinition')
    .filter((record) => /^MineableRock_/i.test(record.entityClass))
    .sort((a, b) => a.path.localeCompare(b.path));
  const rows: DataCoreMiningRockSignatureRecord[] = [];

  for (const record of records) {
    const classification = classifyMineableRock(record.entityClass);
    if (!classification) continue;

    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore mining rock signature XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const signatureValues = $('SSCSignatureSystemParams SSCSignatureSystemBaseSignatureParams > signatures > Single')
      .toArray()
      .map((element) => $(element).attr('value') ?? '');
    const scanSignature =
      signatureValues[SCAN_SIGNATURE_INDEX] ?? signatureValues.find((value) => Number(value) > 0) ?? '';

    rows.push({
      ref: record.ref,
      path: record.path,
      entityClass: record.entityClass,
      variantFamily: classification.family,
      rarity: classification.rarity,
      elementToken: classification.elementToken,
      scanSignature,
    });
  }

  return rows;
}

interface RockClassification {
  family: DataCoreMiningRockSignatureRecord['variantFamily'];
  rarity: string;
  elementToken: string;
}

function classifyMineableRock(entityClass: string): RockClassification | undefined {
  for (const { pattern, family } of VARIANT_FAMILY_PATTERNS) {
    const match = pattern.exec(entityClass);
    if (!match) continue;
    const rarity = match.groups?.rarity?.toLowerCase() ?? '';
    const remainder = entityClass.slice(match[0].length);
    const elementToken = stripSizeSuffix(remainder);
    if (!elementToken) continue;
    return { family, rarity, elementToken };
  }
  return undefined;
}

function stripSizeSuffix(token: string): string {
  let stripped = token;
  while (SIZE_SUFFIX_PATTERN.test(stripped)) {
    stripped = stripped.replace(SIZE_SUFFIX_PATTERN, '');
  }
  return stripped;
}
