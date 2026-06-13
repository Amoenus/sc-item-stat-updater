import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import { uniqueGraphGuidReference } from './record-graph-relations';
import type { DataCoreMiningQualityDistributionRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_MINING_QUALITY_PATH_PREFIX = 'libs/foundry/records/crafting/qualitydistribution';
const MINING_QUALITY_FAMILIES = new Set(['fpsmineables', 'groundmineables', 'shipmineables']);

export interface ExtractDataCoreMiningQualityDistributionsOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  pathPrefix?: string;
}

export async function extractDataCoreMiningQualityDistributions(
  options: ExtractDataCoreMiningQualityDistributionsOptions,
): Promise<DataCoreMiningQualityDistributionRecord[]> {
  const records = options.graph
    .getByPathPrefix(options.pathPrefix ?? DEFAULT_MINING_QUALITY_PATH_PREFIX)
    .filter(
      (record) =>
        (record.rootType === 'CraftingQualityDistributionRecord' ||
          record.rootType === 'CraftingQualityLocationOverrideRecord') &&
        MINING_QUALITY_FAMILIES.has(mineableFamily(record.path)),
    )
    .sort((a, b) => a.path.localeCompare(b.path));
  const rows: DataCoreMiningQualityDistributionRecord[] = [];

  for (const record of records) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore mining quality distribution XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);

    if (record.rootType === 'CraftingQualityDistributionRecord') {
      const distribution = $(':root').first().find('> qualityDistribution > CraftingQualityDistributionNormal').first();
      if (!distribution.length) continue;
      rows.push(rowFromDistribution(record, 'default', mineableFamily(record.path), '', undefined, distribution));
      continue;
    }

    $('CraftingQualityLocationOverrideEntry').each((_index, element) => {
      const entry = $(element);
      const distribution = entry.find('> qualityDistribution > CraftingQualityDistributionNormal').first();
      if (!distribution.length) return;

      const locationGuid = entry.attr('location')
        ? graphGuidReference(record, ['location'], entry.attr('location') ?? '')
        : '';
      const location = locationGuid ? options.graph.getByRef(locationGuid) : undefined;
      rows.push(
        rowFromDistribution(
          record,
          'location-override',
          mineableFamily(record.path),
          locationGuid,
          location,
          distribution,
        ),
      );
    });
  }

  return rows;
}

function rowFromDistribution(
  record: DataCoreRecordNode,
  distributionType: string,
  family: string,
  locationGuid: string,
  location: DataCoreRecordNode | undefined,
  distribution: ReturnType<ReturnType<typeof loadXml>>,
): DataCoreMiningQualityDistributionRecord {
  return {
    ref: record.ref,
    path: record.path,
    distributionClass: record.entityClass,
    distributionType,
    mineableFamily: family,
    locationGuid,
    locationClass: location?.entityClass ?? '',
    locationPath: location?.path ?? '',
    minQuality: distribution.attr('min') ?? '',
    maxQuality: distribution.attr('max') ?? '',
    mean: distribution.attr('mean') ?? '',
    stddev: distribution.attr('stddev') ?? '',
  };
}

function mineableFamily(recordPath: string): string {
  const parts = recordPath.split('/');
  const index = parts.indexOf('qualitydistribution');
  return index === -1 ? '' : (parts[index + 1] ?? '');
}

function graphGuidReference(record: DataCoreRecordNode, attributes: string[], fallback: string): string {
  return uniqueGraphGuidReference(record, attributes, fallback);
}
