import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import { createDataCoreManufacturerResolver } from './manufacturer-resolver';
import { uniqueGraphGuidReference } from './record-graph-relations';
import type { DataCoreRecordGraphLookup, DataCoreRecordNode, DataCoreVehicleRecord } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_VEHICLE_PATH_PREFIXES = [
  'libs/foundry/records/entities/spaceships',
  'libs/foundry/records/entities/groundvehicles',
] as const;

export interface ExtractDataCoreVehiclesOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  pathPrefixes?: string[];
}

export async function extractDataCoreVehicles(
  options: ExtractDataCoreVehiclesOptions,
): Promise<DataCoreVehicleRecord[]> {
  const manufacturerResolver = createDataCoreManufacturerResolver(options.graph);
  const records = (options.pathPrefixes ?? [...DEFAULT_VEHICLE_PATH_PREFIXES])
    .flatMap((prefix) => options.graph.getByPathPrefix(prefix))
    .filter((record) => record.rootType === 'EntityClassDefinition')
    .sort((a, b) => a.path.localeCompare(b.path));
  const seen = new Set<string>();
  const rows: DataCoreVehicleRecord[] = [];

  for (const record of records) {
    if (seen.has(record.path)) continue;
    seen.add(record.path);

    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore vehicle XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const vehicleParams = $('VehicleComponentParams').first();
    if (!vehicleParams.length) continue;

    const manufacturerGuid = graphGuidReference(record, ['manufacturer'], vehicleParams.attr('manufacturer') ?? '');
    const manufacturer = manufacturerGuid ? manufacturerResolver.getByRef(manufacturerGuid) : undefined;

    rows.push({
      ref: record.ref,
      path: record.path,
      entityClass: record.entityClass,
      vehicleNameKey: graphLocalizationKey(
        record,
        ['vehicleName', 'name', 'displayName'],
        vehicleParams.attr('vehicleName') ?? '',
      ),
      vehicleDescriptionKey: graphLocalizationKey(
        record,
        ['vehicleDescription', 'description', 'displayDescription'],
        vehicleParams.attr('vehicleDescription') ?? '',
      ),
      manufacturerGuid,
      manufacturerCode: manufacturer?.code ?? '',
      manufacturerNameKey: manufacturer?.nameKey ?? '',
      movementClass: vehicleParams.attr('movementClass') ?? '',
      vehicleDefinition: vehicleParams.attr('vehicleDefinition') ?? '',
      modification: vehicleParams.attr('modification') ?? '',
      careerKey: graphLocalizationKey(record, ['vehicleCareer'], vehicleParams.attr('vehicleCareer') ?? ''),
      careerGuid: graphGuidReference(record, ['vehicleCareerRef'], vehicleParams.attr('vehicleCareerRef') ?? ''),
      roleKey: graphLocalizationKey(record, ['vehicleRole'], vehicleParams.attr('vehicleRole') ?? ''),
      roleGuid: graphGuidReference(record, ['vehicleRoleRef'], vehicleParams.attr('vehicleRoleRef') ?? ''),
      crewSize: vehicleParams.attr('crewSize') ?? '',
      hullDamageNormalization: vehicleParams.attr('vehicleHullDamageNormalizationValue') ?? '',
      allowSoftDestruction: vehicleParams.attr('allowSoftDestruction') ?? '',
      dogfightEnabled: vehicleParams.attr('dogfightEnabled') ?? '',
      isGravlevVehicle: vehicleParams.attr('isGravlevVehicle') ?? '',
      inventoryContainerGuid: graphGuidReference(
        record,
        ['inventoryContainerParams'],
        vehicleParams.attr('inventoryContainerParams') ?? '',
      ),
    });
  }

  return rows;
}

function graphGuidReference(record: DataCoreRecordNode, attributes: string[], fallback: string): string {
  return uniqueGraphGuidReference(record, attributes, fallback);
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
