import fs from 'node:fs/promises';
import type { Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { resolveChildPath } from '../../io/local/path-conventions';
import type { DataCoreCommodityRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_COMMODITY_PATH_PREFIX = 'libs/foundry/records/entities/commodities';
const DEFAULT_CARRYABLE_PATH_PREFIX = 'libs/foundry/records/entities/scitem/carryables';
const DEFAULT_HARVESTABLE_BASE_PATH_PREFIX = 'libs/foundry/records/entities/scitem/harvestables/bases';
const DEFAULT_HAULING_ENTITY_CLASS_PATH_PREFIX = 'libs/foundry/records/entities/haulingentityclass';
const DEFAULT_JURISDICTION_PATH_PREFIX = 'libs/foundry/records/lawsystem/jurisdictions';

export interface ExtractDataCoreCommoditiesOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  pathPrefix?: string;
}

export async function extractDataCoreCommodities(
  options: ExtractDataCoreCommoditiesOptions,
): Promise<DataCoreCommodityRecord[]> {
  const controlledSubstances = await extractControlledSubstanceIndex(options);
  const records = options.graph
    .getByPathPrefix(options.pathPrefix ?? DEFAULT_COMMODITY_PATH_PREFIX)
    .filter((record) => record.rootType === 'EntityClassDefinition')
    .sort((a, b) => a.path.localeCompare(b.path));
  const commodities: DataCoreCommodityRecord[] = [];
  const emittedKeys = new Set<string>();

  for (const record of records) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore commodity XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const commodityParams = $('CommodityComponentParams').first();
    if (!commodityParams.length) continue;

    const purchasableParams = $('SCItemPurchasableParams').first();
    const uiDisplayParams = $('EntityUIDisplayParams').first();
    const occupancy = extractCargoOccupancy($);

    const commodity = withLegalityWarningSource(
      {
        ref: record.ref,
        path: record.path,
        entityClass: record.entityClass,
        nameKey: resolveRecordLocalizationKey(record, ['name', 'displayName'], commodityParams.attr('name')),
        descriptionKey: resolveRecordLocalizationKey(
          record,
          ['description', 'displayDescription'],
          commodityParams.attr('description') ?? uiDisplayParams.attr('displayDescription'),
        ),
        displayNameKey: resolveRecordLocalizationKey(
          record,
          ['displayName', 'name'],
          purchasableParams.attr('displayName') ?? uiDisplayParams.attr('displayName'),
        ),
        displayDescriptionKey: resolveRecordLocalizationKey(
          record,
          ['displayDescription', 'description'],
          uiDisplayParams.attr('displayDescription') ?? commodityParams.attr('description'),
        ),
        displayTypeKey: resolveRecordLocalizationKey(record, ['displayType'], purchasableParams.attr('displayType')),
        typeGuid: graphGuidReference(record, ['type'], commodityParams.attr('type') ?? ''),
        subtypeGuid: graphGuidReference(record, ['subtype'], commodityParams.attr('subtype') ?? ''),
        cargoOccupancyUnit: occupancy.unit,
        cargoOccupancyValue: occupancy.value,
        cargoOccupancySCU: occupancy.scu,
        boxable: readAttribute(commodityParams, ['boxable']),
        isUnrefinedElement: readAttribute(commodityParams, ['IsUnrefinedElement', 'isUnrefinedElement']),
        isRaw: readAttribute(commodityParams, ['raw', 'Raw', 'isRaw', 'IsRaw']),
        isRefined: readAttribute(commodityParams, ['refined', 'Refined', 'isRefined', 'IsRefined']),
      },
      controlledSubstances,
    );
    markEmittedCommodityKeys(emittedKeys, commodity);
    commodities.push(commodity);
  }

  if (options.pathPrefix !== undefined) return commodities;

  const carryableRows = extractCarryableCommodityRows(options.graph, emittedKeys, controlledSubstances);
  const harvestableRows = extractHarvestableCommodityRows(options.graph, emittedKeys, controlledSubstances);
  const haulingEntityClassRows = await extractHaulingEntityClassCommodityRows(
    options,
    emittedKeys,
    controlledSubstances,
  );
  return [...commodities, ...carryableRows, ...harvestableRows, ...haulingEntityClassRows];
}

interface ControlledSubstanceInfo {
  jurisdictions: Set<string>;
  maxScu: Set<string>;
}

function extractCarryableCommodityRows(
  graph: DataCoreRecordGraphLookup,
  emittedKeys: Set<string>,
  controlledSubstances: Map<string, ControlledSubstanceInfo>,
): DataCoreCommodityRecord[] {
  const rows: DataCoreCommodityRecord[] = [];
  const records = graph
    .getByPathPrefix(DEFAULT_CARRYABLE_PATH_PREFIX)
    .filter((record) => record.rootType === 'EntityClassDefinition')
    .sort((a, b) => a.path.localeCompare(b.path));

  for (const record of records) {
    const nameKey = selectLocalizationKey(record, ['Name', 'name', 'displayName', 'ShortName']);
    if (!nameKey || emittedKeys.has(nameKey.toLowerCase())) continue;

    const row: DataCoreCommodityRecord = withLegalityWarningSource(
      {
        ref: record.ref,
        path: record.path,
        entityClass: record.entityClass,
        nameKey,
        descriptionKey: selectDescriptionLocalizationKey(record, ['Description', 'description', 'displayDescription']),
        displayNameKey: selectLocalizationKey(record, ['Name', 'name', 'ShortName', 'displayName']) || nameKey,
        displayDescriptionKey: selectDescriptionLocalizationKey(record, [
          'displayDescription',
          'Description',
          'description',
        ]),
        displayTypeKey: '',
        typeGuid: '',
        subtypeGuid: '',
        cargoOccupancyUnit: '',
        cargoOccupancyValue: '',
        cargoOccupancySCU: '',
        boxable: '',
        isUnrefinedElement: '',
        isRaw: '',
        isRefined: '',
      },
      controlledSubstances,
    );
    markEmittedCommodityKeys(emittedKeys, row);
    rows.push(row);
  }

  return rows;
}

function extractHarvestableCommodityRows(
  graph: DataCoreRecordGraphLookup,
  emittedKeys: Set<string>,
  controlledSubstances: Map<string, ControlledSubstanceInfo>,
): DataCoreCommodityRecord[] {
  const rows: DataCoreCommodityRecord[] = [];
  const records = graph
    .getByPathPrefix(DEFAULT_HARVESTABLE_BASE_PATH_PREFIX)
    .filter((record) => record.rootType === 'EntityClassDefinition')
    .sort((a, b) => a.path.localeCompare(b.path));

  for (const record of records) {
    const nameKey = selectLocalizationKey(record, ['Name', 'name', 'displayName', 'ShortName'], isHarvestableNameKey);
    if (!nameKey || emittedKeys.has(nameKey.toLowerCase())) continue;

    const row: DataCoreCommodityRecord = withLegalityWarningSource(
      {
        ref: record.ref,
        path: record.path,
        entityClass: record.entityClass,
        nameKey,
        descriptionKey: selectLocalizationKey(
          record,
          ['Description', 'description', 'displayDescription'],
          isHarvestableDescriptionKey,
        ),
        displayNameKey: nameKey,
        displayDescriptionKey: selectLocalizationKey(
          record,
          ['displayDescription', 'Description', 'description'],
          isHarvestableDescriptionKey,
        ),
        displayTypeKey: '',
        typeGuid: '',
        subtypeGuid: '',
        cargoOccupancyUnit: '',
        cargoOccupancyValue: '',
        cargoOccupancySCU: '',
        boxable: '',
        isUnrefinedElement: '',
        isRaw: '',
        isRefined: '',
      },
      controlledSubstances,
    );
    markEmittedCommodityKeys(emittedKeys, row);
    rows.push(row);
  }

  return rows;
}

async function extractHaulingEntityClassCommodityRows(
  options: ExtractDataCoreCommoditiesOptions,
  emittedKeys: Set<string>,
  controlledSubstances: Map<string, ControlledSubstanceInfo>,
): Promise<DataCoreCommodityRecord[]> {
  const rows: DataCoreCommodityRecord[] = [];
  const records = options.graph
    .getByPathPrefix(DEFAULT_HAULING_ENTITY_CLASS_PATH_PREFIX)
    .filter((record) => record.rootType === 'Hauling_EntityClasses')
    .sort((a, b) => a.path.localeCompare(b.path));

  for (const record of records) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore hauling entity class XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const root = $.root().children().first();
    const nameKey =
      graphLocalizationKey(record, ['orderDisplayName']) ||
      normalizeLocalizationKey(root.attr('orderDisplayName') ?? '');
    if (!nameKey || emittedKeys.has(nameKey.toLowerCase())) continue;
    if (!isHaulingEntityClassNameKey(nameKey)) continue;

    const row: DataCoreCommodityRecord = withLegalityWarningSource(
      {
        ref: record.ref,
        path: record.path,
        entityClass: record.entityClass,
        nameKey,
        descriptionKey: '',
        displayNameKey: nameKey,
        displayDescriptionKey: '',
        displayTypeKey: '',
        typeGuid: '',
        subtypeGuid: '',
        cargoOccupancyUnit: '',
        cargoOccupancyValue: '',
        cargoOccupancySCU: '',
        boxable: '',
        isUnrefinedElement: '',
        isRaw: '',
        isRefined: '',
      },
      controlledSubstances,
    );
    markEmittedCommodityKeys(emittedKeys, row);
    rows.push(row);
  }

  return rows;
}

async function extractControlledSubstanceIndex(
  options: ExtractDataCoreCommoditiesOptions,
): Promise<Map<string, ControlledSubstanceInfo>> {
  const index = new Map<string, ControlledSubstanceInfo>();
  const records = options.graph
    .getByPathPrefix(DEFAULT_JURISDICTION_PATH_PREFIX)
    .filter((record) => record.rootType === 'Jurisdiction')
    .sort((a, b) => a.path.localeCompare(b.path));

  for (const record of records) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore jurisdiction XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const jurisdictionName =
      graphLocalizationKey(record, ['name', 'displayName']) ||
      normalizeLocalizationKey($.root().children().first().attr('name') ?? '') ||
      record.entityClass ||
      record.path;

    $('ControlledSubstanceClass').each((_index, element) => {
      const substanceClass = $(element);
      const maxScu = substanceClass.attr('maxPossessionSCU') ?? '';
      substanceClass
        .children('commodities')
        .children('Reference')
        .each((_referenceIndex, referenceElement) => {
          const ref = $(referenceElement).attr('value')?.trim();
          if (!ref) return;
          const info = index.get(ref) ?? { jurisdictions: new Set<string>(), maxScu: new Set<string>() };
          info.jurisdictions.add(jurisdictionName);
          if (maxScu) info.maxScu.add(maxScu);
          index.set(ref, info);
        });
    });
  }

  return index;
}

function withLegalityWarningSource(
  row: Omit<
    DataCoreCommodityRecord,
    'controlledSubstanceJurisdictions' | 'controlledSubstanceMaxScu' | 'legalityWarningSource'
  >,
  controlledSubstances: Map<string, ControlledSubstanceInfo>,
): DataCoreCommodityRecord {
  const controlled = controlledSubstances.get(row.ref);
  if (controlled) {
    return {
      ...row,
      controlledSubstanceJurisdictions: [...controlled.jurisdictions].sort().join('|'),
      controlledSubstanceMaxScu: [...controlled.maxScu].sort().join('|'),
      legalityWarningSource: 'controlled-substance',
    };
  }

  return {
    ...row,
    controlledSubstanceJurisdictions: '',
    controlledSubstanceMaxScu: '',
    legalityWarningSource: isViceCommodity(row) ? 'commodity-type:vice' : '',
  };
}

function isViceCommodity(row: Pick<DataCoreCommodityRecord, 'displayTypeKey' | 'path'>): boolean {
  return row.displayTypeKey === 'items_commodities_type_vice' || /[/\\]commodities[/\\]vice[/\\]/i.test(row.path);
}

function selectLocalizationKey(
  record: DataCoreRecordNode,
  attributes: string[],
  predicate = isUpdaterCommodityLocalizationKey,
): string {
  for (const attribute of attributes) {
    const byAttribute = record.localizationKeys.find(
      (reference) => reference.attribute.toLowerCase() === attribute.toLowerCase() && predicate(reference.key),
    );
    if (byAttribute) return byAttribute.key;
  }

  const byKey = record.localizationKeys.find((reference) => predicate(reference.key));
  return byKey?.key ?? '';
}

function selectDescriptionLocalizationKey(record: DataCoreRecordNode, attributes: string[]): string {
  for (const attribute of attributes) {
    const byAttribute = record.localizationKeys.find(
      (reference) =>
        reference.attribute.toLowerCase() === attribute.toLowerCase() &&
        reference.key.startsWith('items_commodities_') &&
        reference.key.endsWith('_desc'),
    );
    if (byAttribute) return byAttribute.key;
  }

  const byKey = record.localizationKeys.find(
    (reference) => reference.key.startsWith('items_commodities_') && reference.key.endsWith('_desc'),
  );
  return byKey?.key ?? '';
}

function markEmittedCommodityKeys(emittedKeys: Set<string>, row: DataCoreCommodityRecord): void {
  for (const key of [row.nameKey, row.displayNameKey]) {
    if (isDataCoreCommodityLocalizationKey(key)) emittedKeys.add(key.toLowerCase());
  }
}

function isDataCoreCommodityLocalizationKey(key: string): boolean {
  return isUpdaterCommodityLocalizationKey(key) || isHarvestableNameKey(key) || isHaulingEntityClassNameKey(key);
}

function isUpdaterCommodityLocalizationKey(key: string): boolean {
  return key.startsWith('items_commodities_') && !key.endsWith('_desc') && !key.startsWith('items_commodities_type_');
}

function isHarvestableNameKey(key: string): boolean {
  return key.startsWith('harvestable_') && !key.endsWith('_desc');
}

function isHarvestableDescriptionKey(key: string): boolean {
  return key.startsWith('harvestable_') && key.endsWith('_desc');
}

function isHaulingEntityClassNameKey(key: string): boolean {
  return key.startsWith('Salvage_Ship_Component_') && key.endsWith('_Name');
}

function extractCargoOccupancy($: ReturnType<typeof loadXml>): { unit: string; value: string; scu: string } {
  const occupancyUnit = $('CommodityComponentParams > occupancy > *').first();
  const element = occupancyUnit[0];
  if (!occupancyUnit.length || element?.type !== 'tag') return { unit: '', value: '', scu: '' };

  const unit = element.name;
  const value =
    occupancyUnit.attr('SCU') ??
    occupancyUnit.attr('scu') ??
    occupancyUnit.attr('centiSCU') ??
    occupancyUnit.attr('microSCU') ??
    '';

  return { unit, value, scu: toScu(unit, value) };
}

function toScu(unit: string, value: string): string {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '';
  if (unit === 'SCentiCargoUnit') return String(numericValue / 100);
  if (unit === 'SMicroCargoUnit') return String(numericValue / 1_000_000);
  return String(numericValue);
}

function resolveRecordLocalizationKey(
  record: DataCoreRecordNode,
  attributes: string[],
  rawValue: string | undefined,
): string {
  return graphLocalizationKey(record, attributes) || normalizeLocalizationKey(rawValue ?? '');
}

function graphLocalizationKey(record: DataCoreRecordNode, attributes: string[]): string {
  const expectedAttributes = new Set(attributes.map((attribute) => attribute.toLowerCase()));
  const key = record.localizationKeys.find(
    (reference) => expectedAttributes.has(reference.attribute.toLowerCase()) && isUsableLocalizationKey(reference.key),
  )?.key;
  return key ?? '';
}

function graphGuidReference(record: DataCoreRecordNode, attributes: string[], fallback: string): string {
  const expectedAttributes = new Set(attributes.map((attribute) => attribute.toLowerCase()));
  return (
    record.referencedGuidAttributes
      ?.filter((reference) => expectedAttributes.has(reference.attribute.toLowerCase()))
      .map((reference) => reference.value.trim())
      .find((value) => value !== '') ?? fallback
  );
}

function isUsableLocalizationKey(value: string | undefined): boolean {
  const normalized = normalizeLocalizationKey(value ?? '');
  return normalized !== '' && !/^LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i.test(normalized);
}

function normalizeLocalizationKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^@?LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i.test(trimmed)) return '';
  return trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed;
}

function readAttribute(element: Cheerio<AnyNode>, names: string[]): string {
  for (const name of names) {
    const value = element.attr(name);
    if (value !== undefined) return value;
  }
  return '';
}
