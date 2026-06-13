import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import type { DataCoreMiningLocationLabelRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_STARMAP_PATH_PREFIX = 'libs/foundry/records/starmap';
const DEFAULT_MINING_QUALITY_PATH_PREFIX = 'libs/foundry/records/crafting/qualitydistribution';
const MINING_QUALITY_FAMILIES = new Set(['fpsmineables', 'groundmineables', 'shipmineables']);

export interface ExtractDataCoreMiningLocationLabelsOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  starmapPathPrefix?: string;
  qualityPathPrefix?: string;
}

export async function extractDataCoreMiningLocationLabels(
  options: ExtractDataCoreMiningLocationLabelsOptions,
): Promise<DataCoreMiningLocationLabelRecord[]> {
  const qualityLocationRefs = await collectMiningQualityLocationRefs(options);
  const records = options.graph
    .getByPathPrefix(options.starmapPathPrefix ?? DEFAULT_STARMAP_PATH_PREFIX)
    .filter((record) => record.rootType === 'StarMapObject')
    .filter((record) => miningSourceReason(record, qualityLocationRefs))
    .sort((a, b) => a.path.localeCompare(b.path));
  const rows: DataCoreMiningLocationLabelRecord[] = [];

  for (const record of records) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore mining StarMapObject XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const root = $(':root').first();
    if (!root.length) continue;

    const typeGuid = graphGuidReference(record, ['type'], root.attr('type') ?? '');
    const parentGuid = graphGuidReference(record, ['parent'], root.attr('parent') ?? '');
    const parent = parentGuid ? options.graph.getByRef(parentGuid) : undefined;
    const quantumTravelData = root.find('> quantumTravelData > StarMapQuantumTravelDataParams').first();
    const locationParams = root.find('> locationParams > StarMapObjectLocationParams').first();

    rows.push({
      ref: record.ref,
      path: record.path,
      locationClass: record.entityClass,
      sourceReason: miningSourceReason(record, qualityLocationRefs),
      nameKey: graphLocalizationKey(record, ['name', 'displayName'], root.attr('name') ?? ''),
      descriptionKey: graphLocalizationKey(
        record,
        ['description', 'displayDescription'],
        root.attr('description') ?? '',
      ),
      callout1Key: graphLocalizationKey(record, ['callout1'], root.attr('callout1') ?? ''),
      callout2Key: graphLocalizationKey(record, ['callout2'], root.attr('callout2') ?? ''),
      callout3Key: graphLocalizationKey(record, ['callout3'], root.attr('callout3') ?? ''),
      typeGuid,
      parentGuid,
      parentClass: parent?.entityClass ?? '',
      parentPath: parent?.path ?? '',
      locationHierarchyTag: root.attr('locationHierarchyTag') ?? '',
      navIcon: root.attr('navIcon') ?? '',
      size: root.attr('size') ?? '',
      hideInStarmap: root.attr('hideInStarmap') ?? '',
      hideInWorld: root.attr('hideInWorld') ?? '',
      isScannable: root.attr('isScannable') ?? '',
      blockTravel: root.attr('blockTravel') ?? '',
      arrivalRadius: quantumTravelData.attr('arrivalRadius') ?? '',
      adoptionRadius: quantumTravelData.attr('adoptionRadius') ?? '',
      setEntityLocationOnEnter: locationParams.attr('setEntityLocationOnEnter') ?? '',
      exposeForPlayerCreatedMissions: locationParams.attr('exposeForPlayerCreatedMissions') ?? '',
    });
  }

  return rows;
}

async function collectMiningQualityLocationRefs(
  options: ExtractDataCoreMiningLocationLabelsOptions,
): Promise<Set<string>> {
  const refs = new Set<string>();
  const qualityRecords = options.graph
    .getByPathPrefix(options.qualityPathPrefix ?? DEFAULT_MINING_QUALITY_PATH_PREFIX)
    .filter((record) => record.rootType === 'CraftingQualityLocationOverrideRecord')
    .filter((record) => MINING_QUALITY_FAMILIES.has(qualityFamily(record.path)));

  for (const record of qualityRecords) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore mining quality location XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    $('CraftingQualityLocationOverrideEntry[location]').each((_index, element) => {
      const ref = $(element).attr('location') ?? '';
      if (ref) refs.add(ref);
    });
  }

  return refs;
}

function miningSourceReason(record: DataCoreRecordNode, qualityLocationRefs: Set<string>): string {
  const reasons: string[] = [];
  if (/mining/i.test(`${record.entityClass} ${record.path}`)) reasons.push('class-or-path-mining');
  if (/\bmine\b|mine_|_mine|miner|mines/i.test(`${record.entityClass} ${record.path}`))
    reasons.push('class-or-path-mine');
  if (qualityLocationRefs.has(record.ref)) reasons.push('mining-quality-location');
  return reasons.join(';');
}

function qualityFamily(recordPath: string): string {
  const parts = recordPath.split('/');
  const index = parts.indexOf('qualitydistribution');
  return index === -1 ? '' : (parts[index + 1] ?? '');
}

function graphLocalizationKey(record: DataCoreRecordNode, attributes: string[], fallback: string): string {
  const expectedAttributes = new Set(attributes.map((attribute) => attribute.toLowerCase()));
  return (
    record.localizationKeys
      .filter((reference) => expectedAttributes.has(reference.attribute.toLowerCase()))
      .map((reference) => localizationKey(reference.key))
      .find((candidate) => candidate !== '') ?? localizationKey(fallback)
  );
}

function graphGuidReference(record: DataCoreRecordNode, attributes: string[], fallback: string): string {
  const expectedAttributes = new Set(attributes.map((attribute) => attribute.toLowerCase()));
  return (
    record.referencedGuidAttributes?.find((reference) => expectedAttributes.has(reference.attribute.toLowerCase()))
      ?.value ?? fallback
  );
}

function localizationKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^@?LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i.test(trimmed)) return '';
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}
