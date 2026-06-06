import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import { createDataCoreManufacturerResolver } from './manufacturer-resolver';
import type { DataCoreRecordGraphLookup, DataCoreVehicleRecord } from './types';
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

    const manufacturerGuid = vehicleParams.attr('manufacturer') ?? '';
    const manufacturer = manufacturerGuid ? manufacturerResolver.getByRef(manufacturerGuid) : undefined;

    rows.push({
      ref: record.ref,
      path: record.path,
      entityClass: record.entityClass,
      vehicleNameKey: localizationKey(vehicleParams.attr('vehicleName') ?? ''),
      vehicleDescriptionKey: localizationKey(vehicleParams.attr('vehicleDescription') ?? ''),
      manufacturerGuid,
      manufacturerCode: manufacturer?.code ?? '',
      manufacturerNameKey: manufacturer?.nameKey ?? '',
      movementClass: vehicleParams.attr('movementClass') ?? '',
      vehicleDefinition: vehicleParams.attr('vehicleDefinition') ?? '',
      modification: vehicleParams.attr('modification') ?? '',
      careerKey: localizationKey(vehicleParams.attr('vehicleCareer') ?? ''),
      careerGuid: vehicleParams.attr('vehicleCareerRef') ?? '',
      roleKey: localizationKey(vehicleParams.attr('vehicleRole') ?? ''),
      roleGuid: vehicleParams.attr('vehicleRoleRef') ?? '',
      crewSize: vehicleParams.attr('crewSize') ?? '',
      hullDamageNormalization: vehicleParams.attr('vehicleHullDamageNormalizationValue') ?? '',
      allowSoftDestruction: vehicleParams.attr('allowSoftDestruction') ?? '',
      dogfightEnabled: vehicleParams.attr('dogfightEnabled') ?? '',
      isGravlevVehicle: vehicleParams.attr('isGravlevVehicle') ?? '',
      inventoryContainerGuid: vehicleParams.attr('inventoryContainerParams') ?? '',
    });
  }

  return rows;
}

function localizationKey(value: string): string {
  return value.startsWith('@') ? value.slice(1) : value;
}
