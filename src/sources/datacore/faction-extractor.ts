import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import type { DataCoreFactionRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_FACTION_PATH_PREFIX = 'libs/foundry/records/factions';
const REPUTATION_PROPERTY_NAMES = {
  description: 'entityDescription',
  lawful: 'entityLawful',
  headquarters: 'entityHeadquarters',
  founded: 'entityFounded',
  leadership: 'entityLeadership',
  area: 'entityArea',
  focus: 'entityFocus',
} as const;

export interface ExtractDataCoreFactionsOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  pathPrefix?: string;
}

interface FactionReputationMetadata {
  record?: DataCoreRecordNode;
  displayNameKey: string;
  descriptionKey: string;
  headquartersKey: string;
  foundedKey: string;
  leadershipKey: string;
  areaKey: string;
  focusKey: string;
  lawful: string;
}

export async function extractDataCoreFactions(
  options: ExtractDataCoreFactionsOptions,
): Promise<DataCoreFactionRecord[]> {
  const factionRecords = options.graph
    .getByPathPrefix(options.pathPrefix ?? DEFAULT_FACTION_PATH_PREFIX)
    .filter((record) => record.rootType === 'Faction')
    .sort((a, b) => a.path.localeCompare(b.path));
  const rows: DataCoreFactionRecord[] = [];

  for (const record of factionRecords) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore faction XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const root = $(':root').first();
    if (!root.length) continue;

    const factionReputationGuid = graphGuidReference(record, ['factionReputationRef'], root.attr('factionReputationRef') ?? '');
    const reputation = factionReputationGuid
      ? await readFactionReputation(options, options.graph.getByRef(factionReputationGuid))
      : emptyFactionReputation();

    rows.push({
      ref: record.ref,
      path: record.path,
      factionClass: record.entityClass,
      nameKey: graphLocalizationKey(record, ['name', 'displayName'], root.attr('name') ?? ''),
      descriptionKey: graphLocalizationKey(
        record,
        ['description', 'displayDescription'],
        root.attr('description') ?? '',
      ),
      defaultReaction: root.attr('defaultReaction') ?? '',
      factionType: root.attr('factionType') ?? '',
      ableToArrest: root.attr('ableToArrest') ?? '',
      policesLawfulTrespass: root.attr('policesLawfulTrespass') ?? '',
      policesCriminality: root.attr('policesCriminality') ?? '',
      noLegalRights: root.attr('noLegalRights') ?? '',
      factionReputationGuid,
      factionReputationClass: reputation.record?.entityClass ?? '',
      factionReputationPath: reputation.record?.path ?? '',
      reputationDisplayNameKey: reputation.displayNameKey,
      reputationDescriptionKey: reputation.descriptionKey,
      reputationHeadquartersKey: reputation.headquartersKey,
      reputationFoundedKey: reputation.foundedKey,
      reputationLeadershipKey: reputation.leadershipKey,
      reputationAreaKey: reputation.areaKey,
      reputationFocusKey: reputation.focusKey,
      reputationLawful: reputation.lawful,
      alliedFactionGuids: referenceValues($, 'alliedFactions > Reference').join(';'),
      enemyFactionGuids: referenceValues($, 'enemyFactions > Reference').join(';'),
    });
  }

  return rows;
}

async function readFactionReputation(
  options: ExtractDataCoreFactionsOptions,
  record: DataCoreRecordNode | undefined,
): Promise<FactionReputationMetadata> {
  if (!record) return emptyFactionReputation();

  const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore faction reputation XML path');
  const xml = await fs.readFile(xmlPath, 'utf8');
  const $ = loadXml(xml);
  const root = $(':root').first();
  if (!root.length) return emptyFactionReputation(record);

  return {
    record,
    displayNameKey: graphLocalizationKey(record, ['displayName', 'name'], root.attr('displayName') ?? ''),
    descriptionKey: reputationProperty($, REPUTATION_PROPERTY_NAMES.description),
    headquartersKey: reputationProperty($, REPUTATION_PROPERTY_NAMES.headquarters),
    foundedKey: reputationProperty($, REPUTATION_PROPERTY_NAMES.founded),
    leadershipKey: reputationProperty($, REPUTATION_PROPERTY_NAMES.leadership),
    areaKey: reputationProperty($, REPUTATION_PROPERTY_NAMES.area),
    focusKey: reputationProperty($, REPUTATION_PROPERTY_NAMES.focus),
    lawful: reputationProperty($, REPUTATION_PROPERTY_NAMES.lawful),
  };
}

function emptyFactionReputation(record?: DataCoreRecordNode): FactionReputationMetadata {
  return {
    record,
    displayNameKey: '',
    descriptionKey: '',
    headquartersKey: '',
    foundedKey: '',
    leadershipKey: '',
    areaKey: '',
    focusKey: '',
    lawful: '',
  };
}

function reputationProperty($: ReturnType<typeof loadXml>, propertyName: string): string {
  const property = $(`SReputationContextBBPropertyParams[name="${propertyName}"]`).first();
  const locString = property.find('SBBDynamicPropertyLocString').first();
  if (locString.length) return localizationKey(locString.attr('value') ?? '');

  const boolValue = property.find('SBBDynamicPropertyBool').first();
  if (boolValue.length) return boolValue.attr('value') ?? '';

  return '';
}

function referenceValues($: ReturnType<typeof loadXml>, selector: string): string[] {
  return $(selector)
    .toArray()
    .map((element) => $(element).attr('value') ?? '')
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function graphGuidReference(record: DataCoreRecordNode, attributes: string[], fallback: string): string {
  const expectedAttributes = new Set(attributes.map((attribute) => attribute.toLowerCase()));
  return (
    record.referencedGuidAttributes?.find((reference) => expectedAttributes.has(reference.attribute.toLowerCase()))
      ?.value ?? fallback
  );
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

function localizationKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^@?LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i.test(trimmed)) return '';
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}
