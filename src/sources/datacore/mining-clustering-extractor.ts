import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import type { DataCoreMiningClusteringParamRecord, DataCoreRecordGraphLookup } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_MINING_CLUSTERING_PATH_PREFIX = 'libs/foundry/records/harvestable/clusteringpresets';

export interface ExtractDataCoreMiningClusteringOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  pathPrefix?: string;
}

export async function extractDataCoreMiningClustering(
  options: ExtractDataCoreMiningClusteringOptions,
): Promise<DataCoreMiningClusteringParamRecord[]> {
  const records = options.graph
    .getByPathPrefix(options.pathPrefix ?? DEFAULT_MINING_CLUSTERING_PATH_PREFIX)
    .filter((record) => record.rootType === 'HarvestableClusterPreset')
    .sort((a, b) => a.path.localeCompare(b.path));
  const rows: DataCoreMiningClusteringParamRecord[] = [];

  for (const record of records) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore mining clustering XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const root = $(':root').first();
    if (!root.length) continue;

    $('HarvestableClusterParams').each((index, element) => {
      const params = $(element);
      rows.push({
        ref: record.ref,
        path: record.path,
        clusteringClass: record.entityClass,
        probabilityOfClustering: root.attr('probabilityOfClustering') ?? '',
        paramIndex: String(index),
        relativeProbability: params.attr('relativeProbability') ?? '',
        minSize: params.attr('minSize') ?? '',
        maxSize: params.attr('maxSize') ?? '',
        minProximity: params.attr('minProximity') ?? '',
        maxProximity: params.attr('maxProximity') ?? '',
      });
    });
  }

  return rows;
}
