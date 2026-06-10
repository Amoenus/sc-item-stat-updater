import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import { mapConcurrent } from './concurrency';
import type { DataCoreBlueprintPoolRecord, DataCoreRecordGraphLookup } from './types';
import { loadXml } from './xml-parser';

export interface ExtractDataCoreBlueprintPoolsOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  onProgress?: (current: number, total: number) => void;
}

export async function extractDataCoreBlueprintPools(
  options: ExtractDataCoreBlueprintPoolsOptions,
): Promise<DataCoreBlueprintPoolRecord[]> {
  const records = options.graph.getByRootType('BlueprintPoolRecord');
  const rows: DataCoreBlueprintPoolRecord[] = [];

  options.onProgress?.(0, records.length);

  let completed = 0;
  const mapped = await mapConcurrent(
    records,
    async (record) => {
      const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore BlueprintPool XML path');
      const xml = await fs.readFile(xmlPath, 'utf8');
      const $ = loadXml(xml);

      const blueprintRewards: { guid: string; weight: number }[] = [];
      $('BlueprintReward').each((_, element) => {
        const el = $(element);
        const guid = el.attr('blueprintRecord');
        const weight = Number(el.attr('weight')) || 1;
        if (guid) {
          blueprintRewards.push({ guid, weight });
        }
      });

      completed++;
      options.onProgress?.(completed, records.length);

      if (blueprintRewards.length === 0) {
        return null;
      }

      return {
        ref: record.ref,
        path: record.path,
        poolClass: record.entityClass,
        blueprintGuids: JSON.stringify(blueprintRewards),
      } satisfies DataCoreBlueprintPoolRecord;
    },
    50,
  );

  rows.push(...mapped.filter((row): row is DataCoreBlueprintPoolRecord => row !== null));
  options.onProgress?.(records.length, records.length);
  return rows;
}
