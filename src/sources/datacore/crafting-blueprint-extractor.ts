import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import { mapConcurrent } from './concurrency';
import {
  graphLocalizationKey,
  hasGraphLocalizationReference,
  uniqueGraphGuidReference,
} from './record-graph-relations';
import { createDataCoreRelationshipIndex } from './relationship-index';
import type { DataCoreCraftingBlueprintRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
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
  const relationships = createDataCoreRelationshipIndex(options.graph);
  const rows: DataCoreCraftingBlueprintRecord[] = [];

  options.onProgress?.(0, records.length);

  let completed = 0;
  const mapped = await mapConcurrent(
    records,
    async (record) => {
      const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore CraftingBlueprint XML path');
      const xml = await fs.readFile(xmlPath, 'utf8');
      const $ = loadXml(xml);

      const targetEntityClassRef = graphGuidReference(
        record,
        ['entityClass'],
        $('processSpecificData > CraftingProcess_Creation').attr('entityClass') ?? '',
      );
      const targetEntityNode =
        options.graph.getByRef(targetEntityClassRef) ?? relationships.getRecordForEntityClass(targetEntityClassRef);
      const targetEntityClassGuid = targetEntityNode?.ref ?? targetEntityClassRef;
      const targetEntityClass = targetEntityNode?.entityClass ?? targetEntityClassRef;
      const targetItemNameKey = targetEntityNode ? targetNameLocalizationKey(targetEntityNode) : '';

      // Extract Recipes
      const recipeCosts: { resource: string; minQuality: number; amount: number }[] = [];
      $('CraftingRecipeCosts CraftingCost_Resource').each((index, element) => {
        const el = $(element);
        const costNumber = index + 1;
        const resource = el.attr('resource')
          ? graphGuidReference(record, [craftingRecipeCostResourceAttribute(costNumber)], el.attr('resource') ?? '')
          : '';
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

function targetNameLocalizationKey(record: DataCoreRecordNode): string {
  const attributes = ['Name', 'name', 'displayName', 'ShortName'];
  const graphKey = graphLocalizationKey(record, attributes);
  if (graphKey || hasGraphLocalizationReference(record, attributes)) return graphKey;
  return fallbackNameKey(record);
}

function graphGuidReference(record: DataCoreRecordNode, attributes: string[], fallback: string): string {
  return uniqueGraphGuidReference(record, attributes, fallback);
}

function craftingRecipeCostResourceAttribute(costNumber: number): string {
  return `CraftingRecipeCost:${costNumber}.resource`;
}

function fallbackNameKey(record: DataCoreRecordNode): string {
  return (
    record.localizationKeys
      .map((reference) => usableLocalizationKey(reference.key))
      .find((key) => /(^|_)name/i.test(key)) ??
    record.localizationKeys.map((reference) => usableLocalizationKey(reference.key)).find((key) => key !== '') ??
    ''
  );
}

function usableLocalizationKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^@?LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i.test(trimmed)) return '';
  return trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed;
}
