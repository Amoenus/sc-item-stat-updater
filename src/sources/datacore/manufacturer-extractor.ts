import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import type { DataCoreManufacturerRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

export interface ExtractDataCoreManufacturersOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
}

export async function extractDataCoreManufacturers(
  options: ExtractDataCoreManufacturersOptions,
): Promise<DataCoreManufacturerRecord[]> {
  const rows: DataCoreManufacturerRecord[] = [];
  const records = options.graph.getByRootType('SCItemManufacturer').sort((a, b) => a.path.localeCompare(b.path));

  for (const record of records) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore manufacturer XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const root = $(':root').first();
    const localization = root.find('Localization').first();

    rows.push({
      ref: record.ref,
      path: record.path,
      manufacturerClass: record.entityClass,
      code: root.attr('Code') ?? '',
      nameKey: graphLocalizationKey(record, ['Name', 'name', 'displayName'], localization.attr('Name') ?? ''),
      shortNameKey: graphLocalizationKey(record, ['ShortName'], localization.attr('ShortName') ?? ''),
      descriptionKey: graphLocalizationKey(
        record,
        ['Description', 'description', 'displayDescription'],
        localization.attr('Description') ?? '',
      ),
      logo: root.attr('Logo') ?? '',
      logoFullColor: root.attr('LogoFullColor') ?? '',
      logoSimplifiedWhite: root.attr('LogoSimplifiedWhite') ?? '',
      dashboardCanvasConfigGuid: root.attr('DashboardCanvasConfig') ?? '',
      buildingBlocksStyleGuid: root.attr('BuildingBlocksStyle') ?? '',
      audioManufacturerTagGuid: root.attr('AudioManufacturerTag') ?? '',
      lightAmplificationGuid: root.attr('LightAmplification') ?? '',
    });
  }

  return rows;
}

function graphLocalizationKey(record: DataCoreRecordNode, attributes: string[], fallback: string): string {
  for (const attribute of attributes) {
    const key = record.localizationKeys.find((reference) => reference.attribute === attribute)?.key ?? '';
    if (isUsableLocalizationKey(key)) return key;
  }
  return localizationKey(fallback);
}

function isUsableLocalizationKey(value: string): boolean {
  const normalized = localizationKey(value);
  return normalized !== '' && !/^LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i.test(normalized);
}

function localizationKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '@LOC_EMPTY') return '';
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}
