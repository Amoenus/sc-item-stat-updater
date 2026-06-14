import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import { mapConcurrent } from './concurrency';
import { graphGuidReferences, graphLocalizationKeyWithFallback } from './record-graph-relations';
import type { DataCoreMaterialLocalizationRecord, DataCoreRecordGraphLookup } from './types';
import { loadXml } from './xml-parser';

export interface ExtractDataCoreMaterialLocalizationsOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  onProgress?: (current: number, total: number) => void;
}

export async function extractDataCoreMaterialLocalizations(
  options: ExtractDataCoreMaterialLocalizationsOptions,
): Promise<DataCoreMaterialLocalizationRecord[]> {
  const records = options.graph.getByRootType('EntityClassDefinition');
  const rows: DataCoreMaterialLocalizationRecord[] = [];

  let completed = 0;
  const mapped = await mapConcurrent(
    records,
    async (record) => {
      const chunkRows: DataCoreMaterialLocalizationRecord[] = [];
      const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore EntityClassDefinition XML path');
      const xml = await fs.readFile(xmlPath, 'utf8').catch(() => null);
      if (!xml) {
        completed++;
        return chunkRows;
      }
      const $ = loadXml(xml);
      const resourceGuids = graphGuidReferences(record, ['entry']);

      for (const resourceGuid of resourceGuids.length ? resourceGuids : xmlResourceGuids($)) {
        if (resourceGuid) {
          const locName = graphLocalizationKeyWithFallback(
            record,
            ['Name', 'name', 'displayName', 'ShortName'],
            $('Localization').first().attr('Name') ?? '',
          );
          if (locName) {
            chunkRows.push({
              resourceGuid,
              localizationKey: locName,
            });
          }
        }
      }

      completed++;
      options.onProgress?.(completed, records.length);
      return chunkRows;
    },
    50,
  );

  const flat = mapped.flat();
  // Deduplicate
  const seen = new Set<string>();
  for (const row of flat) {
    if (!seen.has(row.resourceGuid)) {
      seen.add(row.resourceGuid);
      rows.push(row);
    }
  }

  options.onProgress?.(records.length, records.length);
  return rows;
}

function xmlResourceGuids($: ReturnType<typeof loadXml>): string[] {
  return $('ResourceContainerDefaultCompositionEntry')
    .toArray()
    .map((element) => $(element).attr('entry') ?? '')
    .filter(Boolean);
}
