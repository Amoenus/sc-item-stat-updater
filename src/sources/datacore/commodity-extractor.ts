import fs from 'node:fs/promises';
import type { Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { resolveChildPath } from '../../io/local/path-conventions';
import type { DataCoreCommodityRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_COMMODITY_PATH_PREFIX = 'libs/foundry/records/entities/commodities';
const DEFAULT_CARRYABLE_PATH_PREFIX = 'libs/foundry/records/entities/scitem/carryables';

export interface ExtractDataCoreCommoditiesOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  pathPrefix?: string;
}

export async function extractDataCoreCommodities(
  options: ExtractDataCoreCommoditiesOptions,
): Promise<DataCoreCommodityRecord[]> {
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

    const commodity = {
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
      typeGuid: commodityParams.attr('type') ?? '',
      subtypeGuid: commodityParams.attr('subtype') ?? '',
      cargoOccupancyUnit: occupancy.unit,
      cargoOccupancyValue: occupancy.value,
      cargoOccupancySCU: occupancy.scu,
      boxable: readAttribute(commodityParams, ['boxable']),
      isUnrefinedElement: readAttribute(commodityParams, ['IsUnrefinedElement', 'isUnrefinedElement']),
      isRaw: readAttribute(commodityParams, ['raw', 'Raw', 'isRaw', 'IsRaw']),
      isRefined: readAttribute(commodityParams, ['refined', 'Refined', 'isRefined', 'IsRefined']),
    };
    markEmittedCommodityKeys(emittedKeys, commodity);
    commodities.push(commodity);
  }

  if (options.pathPrefix !== undefined) return commodities;

  const carryableRows = extractCarryableCommodityRows(options.graph, emittedKeys);
  return [...commodities, ...carryableRows];
}

function extractCarryableCommodityRows(
  graph: DataCoreRecordGraphLookup,
  emittedKeys: Set<string>,
): DataCoreCommodityRecord[] {
  const rows: DataCoreCommodityRecord[] = [];
  const records = graph
    .getByPathPrefix(DEFAULT_CARRYABLE_PATH_PREFIX)
    .filter((record) => record.rootType === 'EntityClassDefinition')
    .sort((a, b) => a.path.localeCompare(b.path));

  for (const record of records) {
    const nameKey = selectLocalizationKey(record, ['Name', 'name', 'displayName', 'ShortName']);
    if (!nameKey || emittedKeys.has(nameKey.toLowerCase())) continue;

    const row: DataCoreCommodityRecord = {
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
    };
    markEmittedCommodityKeys(emittedKeys, row);
    rows.push(row);
  }

  return rows;
}

function selectLocalizationKey(record: DataCoreRecordNode, attributes: string[]): string {
  for (const attribute of attributes) {
    const byAttribute = record.localizationKeys.find(
      (reference) =>
        reference.attribute.toLowerCase() === attribute.toLowerCase() &&
        isUpdaterCommodityLocalizationKey(reference.key),
    );
    if (byAttribute) return byAttribute.key;
  }

  const byKey = record.localizationKeys.find((reference) => isUpdaterCommodityLocalizationKey(reference.key));
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
    if (isUpdaterCommodityLocalizationKey(key)) emittedKeys.add(key.toLowerCase());
  }
}

function isUpdaterCommodityLocalizationKey(key: string): boolean {
  return key.startsWith('items_commodities_') && !key.endsWith('_desc') && !key.startsWith('items_commodities_type_');
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
  const key = normalizeLocalizationKey(rawValue ?? '');
  if (!key) return '';

  const byAttribute = record.localizationKeys.find(
    (reference) => attributes.includes(reference.attribute) && reference.key === key,
  );
  if (byAttribute) return byAttribute.key;

  const byKey = record.localizationKeys.find((reference) => reference.key === key);
  return byKey?.key ?? key;
}

function normalizeLocalizationKey(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed;
}

function readAttribute(element: Cheerio<AnyNode>, names: string[]): string {
  for (const name of names) {
    const value = element.attr(name);
    if (value !== undefined) return value;
  }
  return '';
}
