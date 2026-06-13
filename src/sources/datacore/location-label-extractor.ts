import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import type { DataCoreLocationLabelRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_STARMAP_PATH_PREFIX = 'libs/foundry/records/starmap';

export interface ExtractDataCoreLocationLabelsOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  starmapPathPrefix?: string;
}

export async function extractDataCoreLocationLabels(
  options: ExtractDataCoreLocationLabelsOptions,
): Promise<DataCoreLocationLabelRecord[]> {
  const records = options.graph
    .getByPathPrefix(options.starmapPathPrefix ?? DEFAULT_STARMAP_PATH_PREFIX)
    .filter((record) => record.rootType === 'StarMapObject')
    .sort((a, b) => a.path.localeCompare(b.path));
  const rows: DataCoreLocationLabelRecord[] = [];

  for (const record of records) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore StarMapObject XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const root = $(':root').first();
    if (!root.length) continue;

    const typeGuid = graphGuidReference(record, ['type'], root.attr('type') ?? '');
    const parentGuid = graphGuidReference(record, ['parent'], root.attr('parent') ?? '');
    const affiliationGuid = graphGuidReference(record, ['affiliation'], root.attr('affiliation') ?? '');
    const jurisdictionGuid = graphGuidReference(record, ['jurisdiction'], root.attr('jurisdiction') ?? '');
    const parent = parentGuid ? options.graph.getByRef(parentGuid) : undefined;
    const affiliation = affiliationGuid ? options.graph.getByRef(affiliationGuid) : undefined;
    const jurisdiction = jurisdictionGuid ? options.graph.getByRef(jurisdictionGuid) : undefined;
    const quantumTravelData = root.find('> quantumTravelData > StarMapQuantumTravelDataParams').first();
    const locationParams = root.find('> locationParams > StarMapObjectLocationParams').first();

    rows.push({
      ref: record.ref,
      path: record.path,
      locationClass: record.entityClass,
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
      affiliationGuid,
      affiliationClass: affiliation?.entityClass ?? '',
      affiliationPath: affiliation?.path ?? '',
      affiliationNameKey: firstLocalizationKey(affiliation, ['displayName', 'name']),
      jurisdictionGuid,
      jurisdictionClass: jurisdiction?.entityClass ?? '',
      jurisdictionPath: jurisdiction?.path ?? '',
      jurisdictionNameKey: firstLocalizationKey(jurisdiction, ['name', 'displayName']),
      respawnLocationType: root.attr('respawnLocationType') ?? '',
      locationHierarchyTag: root.attr('locationHierarchyTag') ?? '',
      navIcon: root.attr('navIcon') ?? '',
      size: root.attr('size') ?? '',
      hideInStarmap: root.attr('hideInStarmap') ?? '',
      hideInWorld: root.attr('hideInWorld') ?? '',
      hideWhenInAdoptionRadius: root.attr('hideWhenInAdoptionRadius') ?? '',
      onlyShowWhenParentSelected: root.attr('onlyShowWhenParentSelected') ?? '',
      overrideShowInAllZones: root.attr('overrideShowInAllZones') ?? '',
      overridePermanent: root.attr('overridePermanent') ?? '',
      minimumDisplaySize: root.attr('minimumDisplaySize') ?? '',
      blockTravel: root.attr('blockTravel') ?? '',
      isScannable: root.attr('isScannable') ?? '',
      showOrbitLine: root.attr('showOrbitLine') ?? '',
      useHoloMaterial: root.attr('useHoloMaterial') ?? '',
      noAutoBodyRecovery: root.attr('noAutoBodyRecovery') ?? '',
      arrivalRadius: quantumTravelData.attr('arrivalRadius') ?? '',
      adoptionRadius: quantumTravelData.attr('adoptionRadius') ?? '',
      setEntityLocationOnEnter: locationParams.attr('setEntityLocationOnEnter') ?? '',
      exposeForPlayerCreatedMissions: locationParams.attr('exposeForPlayerCreatedMissions') ?? '',
      starMapGeomPath: root.attr('starMapGeomPath') ?? '',
      starMapMaterialPath: root.attr('starMapMaterialPath') ?? '',
      starMapShapePath: root.attr('starMapShapePath') ?? '',
      locationImagePath: root.attr('locationImagePath') ?? '',
    });
  }

  return rows;
}

function firstLocalizationKey(record: DataCoreRecordNode | undefined, attributes: string[]): string {
  if (!record) return '';
  const expectedAttributes = new Set(attributes.map((attribute) => attribute.toLowerCase()));
  return (
    record.localizationKeys
      .filter((reference) => expectedAttributes.has(reference.attribute.toLowerCase()))
      .map((reference) => localizationKey(reference.key))
      .find((candidate) => candidate !== '') ?? ''
  );
}

function graphLocalizationKey(record: DataCoreRecordNode, attributes: string[], fallback: string): string {
  return firstLocalizationKey(record, attributes) || localizationKey(fallback);
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
