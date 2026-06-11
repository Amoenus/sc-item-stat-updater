import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import { mapConcurrent } from './concurrency';
import type { DataCoreCraftingBlueprintRecord, DataCoreRecordGraphLookup } from './types';
import { loadXml } from './xml-parser';

export interface ExtractDataCoreCraftingBlueprintsOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  onProgress?: (current: number, total: number) => void;
}

export async function extractDataCoreCraftingBlueprints(
  options: ExtractDataCoreCraftingBlueprintsOptions,
): Promise<DataCoreCraftingBlueprintRecord[]> {
  const records = options.graph.getByRootType('CraftingBlueprintRecord');
  const rows: DataCoreCraftingBlueprintRecord[] = [];

  options.onProgress?.(0, records.length);

  let completed = 0;
  const mapped = await mapConcurrent(
    records,
    async (record) => {
      const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore CraftingBlueprint XML path');
      const xml = await fs.readFile(xmlPath, 'utf8');
      const $ = loadXml(xml);

      const targetEntityClassRef = $('processSpecificData > CraftingProcess_Creation').attr('entityClass') ?? '';
      const targetEntityNode =
        options.graph.getByRef(targetEntityClassRef) ?? options.graph.getByEntityClass(targetEntityClassRef)[0];
      const targetEntityClassGuid = targetEntityNode?.ref ?? targetEntityClassRef;
      const targetEntityClass = targetEntityNode?.entityClass ?? targetEntityClassRef;
      const targetItemNameKey =
        targetEntityNode?.localizationKeys.find((l) => /(^|_)name/i.test(l.key) && !/^LOC_/i.test(l.key))?.key ??
        targetEntityNode?.localizationKeys.find((l) => !/^LOC_/i.test(l.key))?.key ??
        '';

      // Extract Recipes
      const recipeCosts: { resource: string; minQuality: number; amount: number }[] = [];
      $('CraftingRecipeCosts CraftingCost_Resource').each((_, element) => {
        const el = $(element);
        const resource = el.attr('resource');
        const minQuality = Number(el.attr('minQuality')) || 0;
        const amount = Number(el.find('> quantity > SStandardCargoUnit').attr('standardCargoUnits')) || 0;
        
        if (resource) {
          recipeCosts.push({ resource, minQuality, amount });
        }
      });

      completed++;
      options.onProgress?.(completed, records.length);

      return {
        ref: record.ref,
        path: record.path,
        blueprintClass: record.entityClass,
        targetEntityClassGuid,
        targetEntityClass,
        targetItemNameKey,
        recipeCosts: JSON.stringify(recipeCosts),
      } satisfies DataCoreCraftingBlueprintRecord;
    },
    50,
  );

  rows.push(...mapped);
  options.onProgress?.(records.length, records.length);
  return rows;
}
