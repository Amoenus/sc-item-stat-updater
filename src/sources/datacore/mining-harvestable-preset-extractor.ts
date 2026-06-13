import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import type { DataCoreMiningHarvestablePresetRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_MINING_HARVESTABLE_PRESET_PATH_PREFIX = 'libs/foundry/records/harvestable/harvestablepresets';

export interface ExtractDataCoreMiningHarvestablePresetsOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  pathPrefix?: string;
}

export async function extractDataCoreMiningHarvestablePresets(
  options: ExtractDataCoreMiningHarvestablePresetsOptions,
): Promise<DataCoreMiningHarvestablePresetRecord[]> {
  const records = options.graph
    .getByPathPrefix(options.pathPrefix ?? DEFAULT_MINING_HARVESTABLE_PRESET_PATH_PREFIX)
    .filter((record) => record.rootType === 'HarvestablePreset')
    .sort((a, b) => a.path.localeCompare(b.path));
  const rows: DataCoreMiningHarvestablePresetRecord[] = [];

  for (const record of records) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore mining harvestable preset XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const root = $(':root').first();
    if (!root.length) continue;

    const harvestableEntityGuid = graphGuidReference(record, ['entityClass'], root.attr('entityClass') ?? '');
    const harvestableEntity = harvestableEntityGuid ? options.graph.getByRef(harvestableEntityGuid) : undefined;
    if (!isMiningHarvestablePreset(record, harvestableEntity)) continue;

    rows.push({
      ref: record.ref,
      path: record.path,
      harvestablePresetClass: record.entityClass,
      harvestableEntityGuid,
      harvestableEntityClass: harvestableEntity?.entityClass ?? '',
      harvestableEntityPath: harvestableEntity?.path ?? '',
      respawnInSlotTime: root.attr('respawnInSlotTime') ?? '',
      specialHarvestableString: root.attr('specialHarvestableString') ?? '',
    });
  }

  return rows;
}

function isMiningHarvestablePreset(
  record: DataCoreRecordNode,
  harvestableEntity: DataCoreRecordNode | undefined,
): boolean {
  if (/mineable|mining/i.test(record.entityClass)) return true;
  return harvestableEntity?.path.includes('/entities/mineable/') ?? false;
}

function graphGuidReference(record: DataCoreRecordNode, attributes: string[], fallback: string): string {
  const expectedAttributes = new Set(attributes.map((attribute) => attribute.toLowerCase()));
  const values = [
    ...new Set(
      record.referencedGuidAttributes
        ?.filter((reference) => expectedAttributes.has(reference.attribute.toLowerCase()))
        .map((reference) => reference.value.trim())
        .filter(Boolean) ?? [],
    ),
  ];
  return values.length === 1 ? values[0] : fallback;
}
